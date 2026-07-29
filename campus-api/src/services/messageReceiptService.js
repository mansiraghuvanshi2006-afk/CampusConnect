import mongoose from "mongoose";

import MessageReceipt from "../models/MessageReceipt.js";

const isDuplicateKeyError = (error) =>
  error?.code === 11000 ||
  /E11000|duplicate key/i.test(String(error?.message || ""));

const toObjectId = (value) => {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }

  return new mongoose.Types.ObjectId(String(value));
};

const upsertOneDelivered = async ({
  messageId,
  conversationId,
  userId,
  stamp,
}) => {
  const messageObjectId = toObjectId(messageId);
  const conversationObjectId = toObjectId(conversationId);
  const userObjectId = toObjectId(userId);

  try {
    await MessageReceipt.updateOne(
      {
        message: messageObjectId,
        user: userObjectId,
      },
      [
        {
          $set: {
            message: messageObjectId,
            conversation: conversationObjectId,
            user: userObjectId,
            deliveredAt: {
              $cond: [
                {
                  $eq: [
                    { $ifNull: ["$deliveredAt", null] },
                    null,
                  ],
                },
                stamp,
                "$deliveredAt",
              ],
            },
            seenAt: {
              $ifNull: ["$seenAt", null],
            },
          },
        },
      ],
      {
        upsert: true,
        updatePipeline: true,
      }
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    // Concurrent insert raced; apply only the timestamp-preserving update.
    await MessageReceipt.updateOne(
      {
        message: messageObjectId,
        user: userObjectId,
      },
      [
        {
          $set: {
            deliveredAt: {
              $cond: [
                {
                  $eq: [
                    { $ifNull: ["$deliveredAt", null] },
                    null,
                  ],
                },
                stamp,
                "$deliveredAt",
              ],
            },
          },
        },
      ],
      { updatePipeline: true }
    );
  }
};

const upsertOneSeen = async ({
  messageId,
  conversationId,
  userId,
  stamp,
}) => {
  const messageObjectId = toObjectId(messageId);
  const conversationObjectId = toObjectId(conversationId);
  const userObjectId = toObjectId(userId);

  try {
    await MessageReceipt.updateOne(
      {
        message: messageObjectId,
        user: userObjectId,
      },
      [
        {
          $set: {
            message: messageObjectId,
            conversation: conversationObjectId,
            user: userObjectId,
            deliveredAt: {
              $cond: [
                {
                  $eq: [
                    { $ifNull: ["$deliveredAt", null] },
                    null,
                  ],
                },
                stamp,
                "$deliveredAt",
              ],
            },
            seenAt: {
              $cond: [
                {
                  $eq: [
                    { $ifNull: ["$seenAt", null] },
                    null,
                  ],
                },
                stamp,
                "$seenAt",
              ],
            },
          },
        },
      ],
      {
        upsert: true,
        updatePipeline: true,
      }
    );
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    await MessageReceipt.updateOne(
      {
        message: messageObjectId,
        user: userObjectId,
      },
      [
        {
          $set: {
            deliveredAt: {
              $cond: [
                {
                  $eq: [
                    { $ifNull: ["$deliveredAt", null] },
                    null,
                  ],
                },
                stamp,
                "$deliveredAt",
              ],
            },
            seenAt: {
              $cond: [
                {
                  $eq: [
                    { $ifNull: ["$seenAt", null] },
                    null,
                  ],
                },
                stamp,
                "$seenAt",
              ],
            },
          },
        },
      ],
      { updatePipeline: true }
    );
  }
};

/**
 * Preserve earliest deliveredAt; never overwrite an existing stamp.
 */
export const upsertDeliveredReceipts = async ({
  messageId,
  conversationId,
  userIds,
  deliveredAt = new Date(),
}) => {
  if (!userIds?.length || !messageId) {
    return [];
  }

  const uniqueIds = [...new Set(userIds.map(String))];
  const stamp = new Date(deliveredAt);

  await Promise.all(
    uniqueIds.map((userId) =>
      upsertOneDelivered({
        messageId,
        conversationId,
        userId,
        stamp,
      })
    )
  );

  return uniqueIds;
};

/**
 * Mark messages read for one user.
 * Rule: preserve earliest seenAt; ensure deliveredAt exists.
 */
export const upsertSeenReceipts = async ({
  messageIds,
  conversationId,
  userId,
  seenAt = new Date(),
}) => {
  if (!messageIds?.length || !userId) {
    return [];
  }

  const uniqueMessageIds = [
    ...new Set(messageIds.map(String)),
  ];
  const stamp = new Date(seenAt);

  await Promise.all(
    uniqueMessageIds.map((messageId) =>
      upsertOneSeen({
        messageId,
        conversationId,
        userId,
        stamp,
      })
    )
  );

  return uniqueMessageIds;
};

/**
 * Load receipts for many messages in one query, grouped by message id.
 */
export const loadReceiptsByMessageIds = async (messageIds) => {
  const ids = [
    ...new Set(
      (messageIds || [])
        .filter(Boolean)
        .map((id) => id.toString())
    ),
  ];

  const map = new Map();

  if (!ids.length) {
    return map;
  }

  const receipts = await MessageReceipt.find({
    message: { $in: ids },
  })
    .select("message user deliveredAt seenAt")
    .lean();

  for (const receipt of receipts) {
    const messageId = receipt.message.toString();
    const bucket = map.get(messageId) || [];
    bucket.push(receipt);
    map.set(messageId, bucket);
  }

  return map;
};

export const serializeReceiptArrays = (receipts = []) => {
  const deliveredTo = [];
  const seenBy = [];

  for (const receipt of receipts) {
    const userId = receipt.user.toString();

    if (receipt.deliveredAt) {
      deliveredTo.push({
        userId,
        deliveredAt: receipt.deliveredAt,
      });
    }

    if (receipt.seenAt) {
      seenBy.push({
        userId,
        seenAt: receipt.seenAt,
      });
    }
  }

  return { deliveredTo, seenBy };
};
