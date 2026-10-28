import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/**
 * Matches the ANSI color sequences of the console, which never reach the files.
 */
const ANSI_PATTERN: RegExp = /\x1b\[[0-9;]*m/g;

/**
 * Pads a date part to two digits.
 *
 * @param value - Number to pad.
 * @returns The padded number.
 */
function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Appends lines to `<log_dir>/<service>/<YYYY-MM>/<YYYY-MM-DD>.log`, without console colors.
 *
 * The file of the day is chosen on every line, so a process that runs past midnight moves to the
 * next file on its own. A failure to write never stops the process.
 */
class DailyFile {
  private directory: string | null = null;

  /**
   * Chooses the folder the lines are written to.
   *
   * @param directory - Folder of the service.
   * @returns The folder of the service.
   */
  open(directory: string): string {
    this.directory = directory;
    return directory;
  }

  /**
   * Stops writing lines.
   */
  close(): void {
    this.directory = null;
  }

  /**
   * Appends a line to the file of today.
   *
   * @param line - Text of the line, without its line break.
   */
  write(line: string): void {
    if (this.directory === null) {
      return;
    }
    const now: Date = new Date();
    const month: string = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const day: string = `${month}-${pad(now.getDate())}`;
    try {
      const folder: string = join(this.directory, month);
      mkdirSync(folder, { recursive: true });
      appendFileSync(join(folder, `${day}.log`), `${line.replace(ANSI_PATTERN, "")}\n`, "utf-8");
    } catch {
      return;
    }
  }
}

const dailyFile: DailyFile = new DailyFile();

/**
 * Appends a line to the log file of the service, when it has one.
 *
 * @param line - Text of the line; console colors are removed.
 */
export function writeLine(line: string): void {
  dailyFile.write(line);
}

/**
 * Sends the log lines of this process to the folder of its service.
 *
 * @param service - Name of the service, which is the name of its folder.
 * @param baseDir - Folder that holds the folders of every service.
 * @returns The folder of the service.
 */
export function setupServiceLogs(service: string, baseDir: string): string {
  return dailyFile.open(join(baseDir, service));
}

/**
 * Stops writing log files.
 */
export function closeServiceLogs(): void {
  dailyFile.close();
}
