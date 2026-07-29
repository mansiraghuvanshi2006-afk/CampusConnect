import { describe, expect, it } from "vitest";

import { mergeMessages } from "./chatHelpers.js";

describe("mergeMessages", () => {
  it("deduplicates by message id across room and personal events", () => {
    const optimistic = {
      id: "tmp-1",
      temporaryId: "tmp-1",
      conversationId: "c1",
      text: "hi",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const saved = {
      id: "m1",
      temporaryId: "tmp-1",
      conversationId: "c1",
      text: "hi",
      createdAt: "2026-01-01T00:00:01.000Z",
    };

    const personalDuplicate = {
      ...saved,
    };

    const merged = mergeMessages(
      [optimistic],
      [saved, personalDuplicate]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("m1");
  });

  it("keeps messages from different conversations separate", () => {
    const merged = mergeMessages(
      [
        {
          id: "m1",
          conversationId: "c1",
          text: "a",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      [
        {
          id: "m1",
          conversationId: "c2",
          text: "b",
          createdAt: "2026-01-01T00:00:01.000Z",
        },
      ]
    );

    expect(merged).toHaveLength(2);
  });
});
