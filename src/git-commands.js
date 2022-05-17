const util = require("util");
const exec = util.promisify(require("child_process").exec);
const readFile = util.promisify(require("fs").readFile);

const gitHead = async () => readFile(".git/HEAD", "utf8");
const currentCommit = async () => {
  const status = await exec("git rev-parse HEAD");
  return status.stdout.trim();
};

const createBranch = async (name, commit) => {
  const status = await exec(`git checkout -b ${name} ${commit}`);
  return status.stdout.trim();
};

module.exports = {
  gitHead,
  currentCommit,
  createBranch,
};
