import { getDb, requireRole } from "../../../lib/api-helpers";

async function handler(req, res) {
  try {
    const db = await getDb();

    const data = await db
      .collection("forwarded_calls")
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    const totalCount = data.length;

    return res.status(200).json(
      data.map((x, idx) => ({
        ...x,
        _id: x._id.toString(),
        srNo: totalCount - idx,
      }))
    );

  } catch (err) {
    console.error("Download Error:", err);
    return res.status(500).json({
      success: false,
      error: "Something went wrong",
    });
  }
}

export default requireRole("admin")(handler);
