import * as core from "@actions/core";
import * as fs from "node:fs";
import { AstrisClient, IAstrisClient, RunStatus } from "@smartesting/astris";

export async function run() {
  const astrisClient: IAstrisClient = new AstrisClient(
    core.getInput("test-runner-url"),
    core.getInput("test-runner-api-key")
  );

  const data = fs.readFileSync(core.getInput("steps-file"), "utf8");
  const testRunId = await astrisClient.addTestRun({
    url: core.getInput("url"),
    steps: JSON.parse(data)
  });

  console.log(
    `[${new Date().toISOString()}] Test run created with ID: ${testRunId}`
  );

  while (true) {
    const { status, stepStatuses } =
      await astrisClient.getTestRunFullStatus(testRunId);

    if (status !== RunStatus.SUCCESS) {
      console.log(
        `[${new Date().toISOString()}] Test run status: ${status} (step ${stepStatuses.filter((stepReport) => stepReport.end !== undefined).length + 1} on ${stepStatuses.length})`
      );
    }

    if (status === RunStatus.RUNNING || status === RunStatus.WAITING) {
      await sleep(2000);
      continue;
    }

    if (status !== RunStatus.SUCCESS) {
      core.setFailed(`[${new Date().toISOString()}] Test run failed`);
    }

    console.log(`[${new Date().toISOString()}] Test run succeeded`);
    core.setOutput("status", status);
    return;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

run();
