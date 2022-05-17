const program = require("commander");

const { version } = require("../package.json");
const { initRepo, statusCodes, addSlide } = require("./slide-deck");
const { currentCommit, branchName } = require("./git-commands");

program
  .version(version)
  .description(
    "Turns your codebase in a slide-deck. Ideal for workshops or partly live coding sessions"
  );

const handleError = (error) => {
  if (error.errorCode === statusCodes.REPO_ALREADY_INITIALIZED) {
    console.log("Error: Repos already has a slide-deck file.");
    process.exit(1);
  }
  console.log("Error: ", error.message);
  process.exit(1);
};

program
  .command("init")
  .description("initialize a slide-deck file")
  .action(async function () {
    try {
      await initRepo();
    } catch (e) {
      handleError(e);
    }
  });

program
  .command("add <name>")
  .description("adds current commit as new slide")
  .action(async function (name) {
    try {
      const commit = await currentCommit();
      await addSlide(name, commit);
    } catch (e) {
      handleError(e);
    }
  });

program
  .command("next")
  .description("stashes changes and goes to the next slide")
  .action(async function () {
    const name = await branchName();
    console.log(name);
    process.exit(1);
  });

async function run(args) {
  program.parse(args);
  if (program.args.length === 0) {
    program.outputHelp();
    return;
  }
}
module.exports = {
  run,
};
