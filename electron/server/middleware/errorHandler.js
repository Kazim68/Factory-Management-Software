const errorHandler = (err, req, res, next) => {
  console.error(err);

  if (err?.code === "P2003") {
    return res.status(409).json({
      error:
        "Unable to delete this record because it is linked to other data. Remove related entries first.",
    });
  }

  return res.status(500).json({ error: "Internal server error" });
};

export default errorHandler;
