/**
 * Snowflake ID Generator
 *
 * Layout (64 bits):
 *   [1 bit unused] [41 bits timestamp ms since epoch] [10 bits machine ID] [12 bits sequence]
 *
 * Custom Epoch: 2024-01-01T00:00:00.000Z = 1704067200000
 * Max sequence per millisecond per node: 4095
 * IDs are returned as strings to avoid JS BigInt precision issues in JSON.
 */

const EPOCH = 1704067200000n;
const MACHINE_ID_BITS = 10n;
const SEQUENCE_BITS = 12n;
const MAX_SEQUENCE = (1n << SEQUENCE_BITS) - 1n; // 4095

class SnowflakeGenerator {
  private machineId: bigint;
  private sequence: bigint = 0n;
  private lastTimestamp: bigint = -1n;

  constructor(machineId: number) {
    if (machineId < 0 || machineId > 1023) {
      throw new RangeError('machineId must be between 0 and 1023');
    }
    this.machineId = BigInt(machineId);
  }

  nextId(): string {
    let timestamp = BigInt(Date.now()) - EPOCH;

    if (timestamp < this.lastTimestamp) {
      // Clock moved backward — hold at last known timestamp
      timestamp = this.lastTimestamp;
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & MAX_SEQUENCE;
      if (this.sequence === 0n) {
        // Sequence exhausted — busy-wait for next millisecond
        let next = BigInt(Date.now()) - EPOCH;
        while (next <= timestamp) {
          next = BigInt(Date.now()) - EPOCH;
        }
        timestamp = next;
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    const id =
      (timestamp << (MACHINE_ID_BITS + SEQUENCE_BITS)) |
      (this.machineId << SEQUENCE_BITS) |
      this.sequence;

    return id.toString();
  }

  /** Extracts the creation timestamp from a Snowflake ID string */
  decodeTimestamp(id: string): Date {
    const timestamp = (BigInt(id) >> (MACHINE_ID_BITS + SEQUENCE_BITS)) + EPOCH;
    return new Date(Number(timestamp));
  }
}

const machineId = parseInt(process.env.MACHINE_ID ?? '1', 10);
export const snowflake = new SnowflakeGenerator(machineId);
