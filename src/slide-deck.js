const util = require("util");
const readFile = util.promisify(require("fs").readFile);
const writeFile = util.promisify(require("fs").writeFile);
const stat = util.promisify(require("fs").stat);

const statusCodes = {
  SUCCESS: 0,
  REPO_ALREADY_INITIALIZED: 1,
};

const newFile = () => ({
  version: "1.0.0",
  slides: [],
});

const DEFAULT_DECK_PATH = ".slide-deck.json";

const initRepo = async () => {
  try {
    const status = await stat(DEFAULT_DECK_PATH);
    if (status.isFile()) {
      return statusCodes.REPO_ALREADY_INITIALIZED;
    }
  } catch (e) {
    writeFile(DEFAULT_DECK_PATH, JSON.stringify(newFile()));
    return statusCodes.SUCCESS;
  }
};

module.exports = {
  initRepo,
  statusCodes,
};
