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

const switchBranch = async (name) => {
  await exec(`git switch ${name}`);
};

/**
 * @param {string} name
 * @param {string} commit
 */
const createBranch = async (name, commit) => {
  await exec(`git branch -f ${name} ${commit}`);
  await switchBranch(name);
};

const stash = async () => {
  await exec(`git stash -u`);
};

/**
 * @param {string} commit
 */
const titleOfCommit = async (commit) => {
  const status = await exec(
    `git log --pretty=format:%s ${commit}^1...${commit}`
  );
  return status.stdout.trim();
};

const isGitRepo = async () => {
  try {
    await gitHead();
    return true;
  } catch (e) {
    return false;
  }
};

module.exports = {
  gitHead,
  currentCommit,
  createBranch,
  branchName,
  switchBranch,
  stash,
  titleOfCommit,
  isGitRepo,
};
