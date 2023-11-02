import chalk from "chalk";

export function link(url: URL | string) {
  return chalk.blue(`<${url.toString()}>`);
}
