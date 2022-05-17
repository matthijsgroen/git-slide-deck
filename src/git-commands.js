const util = require("util");
const exec = util.promisify(require("child_process").exec);
const readFile = util.promisify(require("fs").readFile);

const gitHead = async () => readFile(".git/HEAD", "utf8");
const currentCommit = async () => {
  const status = await exec("git rev-parse HEAD");
  return status.stdout.trim();
};

const branchName = async () => {
  const status = await exec("git rev-parse --abbrev-ref HEAD");
  return status.stdout.trim();
};

const createBranch = async (name, commit) => {
  await exec(`git branch -f ${name} ${commit}`);
  await exec(`git switch ${name}`);
};

module.exports = {
  gitHead,
  currentCommit,
  createBranch,
  branchName,
};
