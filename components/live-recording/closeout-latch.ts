/**
 * The "one close-out per job" mark behind LiveRecorder.beginCloseout /
 * endCloseout.
 *
 * A close-out outlives the composer that runs it: the master upload is an XHR
 * on an Uppy instance the component never destroys, and the liveRecordingStop
 * promise settles whether or not anyone is still there. So the latch cannot be
 * a per-component ref — Stop, navigate away mid-upload, come back via the pill
 * and the fresh mount would find a fresh latch and start a SECOND upload and a
 * second mutation for the one recording. It lives in the recorder (one per
 * shell, outlives every mount) and is keyed by job id, so every mount asks the
 * same question about the same job.
 */
export class CloseoutLatch {
  private inFlight = new Set<string>();

  /** Claim the close-out for a job: false when one is already in flight. */
  begin(jobId: string): boolean {
    if (this.inFlight.has(jobId)) return false;
    this.inFlight.add(jobId);
    return true;
  }

  /** The attempt ended — finished, failed-retryable, or released. Idempotent. */
  end(jobId: string): void {
    this.inFlight.delete(jobId);
  }

  /** The recording is over for good (release/discard): nothing is owed at all. */
  clear(): void {
    this.inFlight.clear();
  }
}
