import { screenText } from "./textModeration.js";
import { findHardBlockedMatch } from "./hardBlockTerms.js";
import { findBlockedLink } from "./linkBlockTerms.js";
import { fileAutoReport } from "./autoReport.js";
import { containsScriptPayload } from "./sanitizeInput.js";

const BLOCK_MESSAGE = "This breaks our content rules and wasn't posted. Staff have been notified and will review it.";
const SCRIPT_BLOCK_MESSAGE = "That looks like code or markup and wasn't posted.";
const LINK_BLOCK_MESSAGE = "That link isn't allowed here and wasn't posted. Staff have been notified and will review it.";
const UNSCREENED_MESSAGE = "We couldn't review this right now. Please try again in a few minutes.";

export async function guardText(text, { authorId, author = null, community, snapshotLabel, failClosed = false }) {
  const value = (text || "").trim();
  if (!value) return { blocked: false, flagged: false, failed: false };

  const reportAuthor = author || (authorId ? { id: authorId } : null);

  const scriptPayload = containsScriptPayload(value);
  if (scriptPayload) {
    await fileAutoReport({
      community,
      targetType: "user",
      targetId: authorId,
      snapshot: snapshotLabel ? `[${snapshotLabel}] ${value}` : value,
      author: reportAuthor,
      category: "script_injection",
      rationale: `Contains "${scriptPayload}"`,
      blocked: true,
    });
    return {
      blocked: true,
      flagged: false,
      failed: false,
      category: "script_injection",
      message: SCRIPT_BLOCK_MESSAGE,
    };
  }

  const hardMatch = findHardBlockedMatch(value);
  if (hardMatch) {
    await fileAutoReport({
      community,
      targetType: "user",
      targetId: authorId,
      snapshot: snapshotLabel ? `[${snapshotLabel}] ${value}` : value,
      author: reportAuthor,
      category: hardMatch.category,
      rationale: `Contains "${hardMatch.term}"`,
      blocked: true,
    });
    return { blocked: true, flagged: false, failed: false, category: hardMatch.category, message: BLOCK_MESSAGE };
  }

  const blockedLink = findBlockedLink(value);
  if (blockedLink) {
    await fileAutoReport({
      community,
      targetType: "user",
      targetId: authorId,
      snapshot: snapshotLabel ? `[${snapshotLabel}] ${value}` : value,
      author: reportAuthor,
      category: "unsafe_link",
      rationale: `Contains blocked link "${blockedLink}"`,
      blocked: true,
    });
    return { blocked: true, flagged: false, failed: false, category: "unsafe_link", message: LINK_BLOCK_MESSAGE };
  }

  const result = await screenText(value);

  if (result.action === "block") {
    await fileAutoReport({
      community,
      targetType: "user",
      targetId: authorId,
      snapshot: snapshotLabel ? `[${snapshotLabel}] ${value}` : value,
      author: reportAuthor,
      category: result.category,
      rationale: result.rationale,
      blocked: true,
    });
    return { blocked: true, flagged: false, failed: false, category: result.category, message: BLOCK_MESSAGE };
  }

  if (result.failed && failClosed) {
    return {
      blocked: true,
      flagged: false,
      failed: true,
      category: "unscreened",
      message: UNSCREENED_MESSAGE,
    };
  }

  return {
    blocked: false,
    flagged: result.action === "report",
    failed: !!result.failed,
    category: result.category,
    rationale: result.rationale,
  };
}

export { BLOCK_MESSAGE };
