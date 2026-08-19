export const runtime = 'nodejs';

import { ObjectId } from 'mongodb';
import { getDb, requireRole } from '../../../lib/api-helpers.js';
import { getCache, setCache } from '../../../lib/redis.js';

function toObjIdIfPossible(id) {
  try {
    if (ObjectId.isValid(id)) return new ObjectId(id);
  } catch (e) {}
  return id;
}

async function handler(req, res, user) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, error: 'Method not allowed' });

  try {
    let { month = '', techId = '', dateFrom = '', dateTo = '', status = '' } = req.query;

    const cacheKey = `admin:technician-calls:${month}:${techId}:${dateFrom}:${dateTo}:${status}`;
    const cachedResult = await getCache(cacheKey);
    if (cachedResult) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cachedResult);
    }

    const db = await getDb();
    const callsColl = db.collection('forwarded_calls');
    const techsColl = db.collection('technicians');
    const paymentsColl = db.collection('payments');

    // Compute date range (dateFrom/dateTo override month)
    let start, end;
    if (dateFrom || dateTo) {
      if (dateFrom) start = new Date(dateFrom + 'T00:00:00');
      if (dateTo) end = new Date(dateTo + 'T23:59:59.999');
      if (start && !end) { const tmp = new Date(start); tmp.setDate(tmp.getDate() + 1); end = tmp; }
      if (!start && end) { const tmp = new Date(end); tmp.setMonth(tmp.getMonth() - 1); start = tmp; }
    } else if (typeof month === 'string' && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(n => parseInt(n, 10));
      start = new Date(y, m - 1, 1, 0, 0, 0, 0);
      end = new Date(y, m, 1, 0, 0, 0, 0);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
    }

    // Tech filter candidates (support string & ObjectId)
    const techCandidates = [];
    if (techId && techId !== 'all' && typeof techId === 'string') {
      techCandidates.push(techId);
      const maybeObj = toObjIdIfPossible(techId);
      if (maybeObj && typeof maybeObj !== 'string') techCandidates.push(maybeObj);
    }

    // Run parallel queries
    const [monthSummaryArr, lifetimeArr, monthStatsArr, lifeStatsArr, paymentsByTechArr, techDocs] = await Promise.all([
      callsColl.aggregate([
        { $addFields: { closedDate: { $ifNull: ['$closedAt', '$updatedAt', '$createdAt'] }, priceNum: { $ifNull: ['$price', 0] } } },
        { $match: { closedDate: { $gte: start, $lt: end }, ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
        { $group: { _id: '$status', countInMonth: { $sum: 1 }, amountInMonth: { $sum: '$priceNum' } } }
      ]).toArray(),

      callsColl.aggregate([
        { $addFields: { priceNum: { $ifNull: ['$price', 0] } } },
        { $match: { status: 'Closed', ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
        { $group: { _id: null, totalClosed: { $sum: 1 }, totalAmount: { $sum: '$priceNum' } } }
      ]).toArray(),

      callsColl.aggregate([
        { $addFields: { closedDate: { $ifNull: ['$closedAt', '$updatedAt', '$createdAt'] }, priceNum: { $ifNull: ['$price', 0] } } },
        { $match: { status: 'Closed', closedDate: { $gte: start, $lt: end }, ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
        { $group: { _id: '$techId', monthClosed: { $sum: 1 }, monthAmountByPrice: { $sum: '$priceNum' } } }
      ]).toArray(),

      callsColl.aggregate([
        { $addFields: { priceNum: { $ifNull: ['$price', 0] } } },
        { $match: { status: 'Closed', ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
        { $group: { _id: '$techId', totalClosed: { $sum: 1 }, totalAmount: { $sum: '$priceNum' } } }
      ]).toArray(),

      paymentsColl.aggregate([
        { $match: { createdAt: { $gte: start, $lt: end }, ...(techCandidates.length ? { techId: { $in: techCandidates } } : {}) } },
        { $unwind: { path: '$calls', preserveNullAndEmptyArrays: false } },
        {
          $addFields: {
            techIdStr: { $toString: '$techId' },
            callPaymentAmount: { $add: [{ $ifNull: ['$calls.onlineAmount', 0] }, { $ifNull: ['$calls.cashAmount', 0] }] }
          }
        },
        { $group: { _id: '$techIdStr', submittedSum: { $sum: '$callPaymentAmount' } } }
      ]).toArray(),

      techsColl.find({}, { projection: { _id: 1, name: 1, fullName: 1, techName: 1, username: 1, phone: 1, avatar: 1, profilePic: 1, bio: 1 } }).sort({ name: 1 }).toArray()
    ]);

    const monthByStatus = {};
    monthSummaryArr.forEach(r => { monthByStatus[r._id || 'UNKNOWN'] = { count: r.countInMonth || 0, amount: r.amountInMonth || 0 }; });
    const lifetimeSummary = lifetimeArr[0] || { totalClosed: 0, totalAmount: 0 };

    const monthMap = new Map();
    monthStatsArr.forEach(r => monthMap.set(String(r._id), { monthClosed: r.monthClosed || 0, monthAmountByPrice: r.monthAmountByPrice || 0 }));

    const lifeMap = new Map();
    lifeStatsArr.forEach(r => lifeMap.set(String(r._id), { totalClosed: r.totalClosed || 0, totalAmount: r.totalAmount || 0 }));

    const paymentsMap = new Map();
    paymentsByTechArr.forEach(r => paymentsMap.set(String(r._id), r.submittedSum || 0));

    let canonicalMonthSubmittedTotal = 0;
    let totalMonthClosedCalls = 0;

    const technicians = techDocs.map(t => {
      const key = String(t._id);
      const monthCallStat = monthMap.get(key) || { monthClosed: 0, monthAmountByPrice: 0 };
      const lifeStat = lifeMap.get(key) || { totalClosed: 0, totalAmount: 0 };
      const monthSubmitted = paymentsMap.get(key) || 0;

      canonicalMonthSubmittedTotal += monthSubmitted;
      totalMonthClosedCalls += monthCallStat.monthClosed;

      const displayName = (t.name && t.name.trim()) ||
        (t.fullName && t.fullName.trim()) ||
        (t.techName && t.techName.trim()) ||
        (t.username && t.username.trim()) ||
        'Unnamed';

      const closedCallsCount = Number(monthCallStat.monthClosed || 0);
      const incentiveRate = 100; // ₹100 per closed call
      const monthlyIncentive = closedCallsCount * incentiveRate;

      return {
        _id: key,
        name: displayName,
        username: t.username || '',
        phone: t.phone || '',
        avatar: t.avatar || t.profilePic || null,
        bio: t.bio || '',
        monthClosed: closedCallsCount,
        monthIncentive: monthlyIncentive,
        incentiveRate: incentiveRate,
        monthAmountByPrice: monthCallStat.monthAmountByPrice,
        totalClosed: lifeStat.totalClosed,
        totalAmount: lifeStat.totalAmount,
        monthSubmitted: monthSubmitted,
        monthAmount: monthSubmitted,
      };
    });

    // Summary calculation
    const summary = {
      monthClosedCalls: totalMonthClosedCalls,
      monthIncentiveTotal: totalMonthClosedCalls * 100,
      monthSubmittedTotal: canonicalMonthSubmittedTotal,
      lifetimeClosedCalls: lifetimeSummary.totalClosed || 0,
      lifetimeClosedAmount: lifetimeSummary.totalAmount || 0,
    };

    // ----- calls list with exact closure timestamps & details -----
    const callsMatchFilter = { closedDate: { $gte: start, $lt: end } };
    if (techCandidates.length) {
      callsMatchFilter.techId = { $in: techCandidates };
    }
    if (status && status !== 'all') {
      callsMatchFilter.status = status;
    }

    const callsPipeline = [
      {
        $addFields: {
          closedDate: { $ifNull: ['$closedAt', '$updatedAt', '$createdAt'] },
          priceNum: { $ifNull: ['$price', 0] },
          callIdStr: { $toString: '$_id' },
          techIdStr: { $toString: '$techId' },
        }
      },
      { $match: callsMatchFilter },
      { $sort: { closedDate: -1 } },

      {
        $lookup: {
          from: 'payments',
          let: { callIdStr: '$callIdStr' },
          pipeline: [
            { $match: { createdAt: { $gte: start, $lt: end } } },
            { $project: { _id: 1, createdAt: 1, mode: 1, receiver: 1, calls: 1 } }
          ],
          as: 'paymentDocs'
        }
      },

      {
        $project: {
          _id: '$callIdStr',
          techId: '$techIdStr',
          techName: 1,
          clientName: 1,
          customerName: 1,
          phone: 1,
          address: 1,
          type: 1,
          status: 1,
          price: '$priceNum',
          createdAt: 1,
          closedAt: 1,
          updatedAt: 1,
          closedByName: 1,
          notes: 1,
          chooseCall: 1,
          matchedPayments: {
            $reduce: {
              input: '$paymentDocs',
              initialValue: [],
              in: {
                $concatArrays: [
                  '$$value',
                  {
                    $map: {
                      input: {
                        $filter: {
                          input: { $ifNull: ['$$this.calls', []] },
                          as: 'pc',
                          cond: { $eq: [{ $toString: '$$pc.callId' }, '$callIdStr'] }
                        }
                      },
                      as: 'mc',
                      in: {
                        paymentId: { $toString: '$$this._id' },
                        paymentCreatedAt: '$$this.createdAt',
                        onlineAmount: { $ifNull: ['$$mc.onlineAmount', 0] },
                        cashAmount: { $ifNull: ['$$mc.cashAmount', 0] },
                        receiver: '$$this.receiver',
                        mode: '$$this.mode'
                      }
                    }
                  }
                ]
              }
            }
          }
        }
      },

      {
        $addFields: {
          submittedAmount: {
            $reduce: {
              input: '$matchedPayments',
              initialValue: 0,
              in: { $add: ['$$value', { $add: ['$$this.onlineAmount', '$$this.cashAmount'] }] }
            }
          },
          lastPaymentAt: { $max: '$matchedPayments.paymentCreatedAt' }
        }
      },

      { $limit: 1000 }
    ];

    const callsList = await callsColl.aggregate(callsPipeline).toArray();

    const result = {
      success: true,
      technicians,
      summary,
      calls: callsList,
      monthSummaryByStatus: monthByStatus
    };

    await setCache(cacheKey, result, 60);

    res.setHeader('X-Cache', 'MISS');
    res.setHeader('Cache-Control', 'private, no-cache');
    return res.status(200).json(result);
  } catch (err) {
    console.error('technician-calls error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Internal Server Error' });
  }
}

export default requireRole('admin')(handler);
