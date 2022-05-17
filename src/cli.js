const program = require("commander");

const { version } = require("../package.json");
const { initRepo, statusCodes, addSlide } = require("./slide-deck");
const { currentCommit } = require("./git-commands");

program
  .version(version)
  .description(
    "Turns your codebase in a slide-deck. Ideal for workshops or partly live coding sessions"
  );

program
  .command("init")
  .description("initialize a slide-deck file")
  .action(async function () {
    const status = await initRepo();
    if (status === statusCodes.REPO_ALREADY_INITIALIZED) {
      console.log("Repos already has a slide-deck file.");
      process.exit(1);
    }
  });

program
  .command("add <name>")
  .description("adds current commit as new slide")
  .action(async function (name) {
    const commit = await currentCommit();
    const status = await addSlide(name, commit);
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
