import "server-only";

/** Dilempar kalau AI menilai idenya melanggar aturan Kuk. */
export class IdeaRejectedError extends Error {
  constructor() {
    super("The idea was rejected by the Kuk rules.");
    this.name = "IdeaRejectedError";
  }
}
