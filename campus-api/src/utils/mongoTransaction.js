/**
 * Detect MongoDB deployments that cannot run multi-document transactions
 * (typically standalone instances without a replica set).
 */
export const isTransactionUnsupportedError = (error) => {
  const message = String(error?.message || "");
  const codeName = String(error?.codeName || "");

  return (
    /Transaction numbers|replica set member|mongos|not supported|IllegalOperation|retryable writes/i.test(
      message
    ) ||
    /TransactionNumbers|IllegalOperation/i.test(codeName) ||
    error?.code === 20
  );
};

/**
 * Run work inside a MongoDB transaction when available.
 * Falls back to the provided standalone path when transactions are unsupported.
 */
export const withOptionalTransaction = async ({
  startSession,
  work,
  fallback,
}) => {
  const session = await startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      result = await work(session);
    });

    return {
      mode: "transaction",
      result,
    };
  } catch (error) {
    if (!isTransactionUnsupportedError(error)) {
      throw error;
    }

    const result = await fallback();

    return {
      mode: "fallback",
      result,
    };
  } finally {
    await session.endSession();
  }
};
