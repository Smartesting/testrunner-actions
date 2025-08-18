import { AstrisClient, RunStatus } from "@smartesting/astris";
import { run } from "./main";
import * as fs from "fs";
import * as core from "@actions/core";
import SpyInstance = jest.SpyInstance;

jest.mock("fs", () => {
  const actualFs = jest.requireActual("fs") as typeof fs;
  return {
    ...actualFs,
    readdirSync: jest.fn(),
    readFileSync: jest.fn(),
  };
});
const mockedFs = fs as jest.Mocked<typeof fs>;

jest.mock("@smartesting/astris", () => {
  return {
    RunStatus: {
      RUNNING: "RUNNING",
      SUCCESS: "SUCCESS",
      ERROR: "ERROR",
    },
    AstrisClient: jest.fn(),
  };
});

const MockedAstrisClient = AstrisClient as jest.Mock;

jest.spyOn(global, "setTimeout").mockImplementation((cb) => {
  cb();
  return 0 as any;
});

describe("GitHub Action run()", () => {
  let setFailed: SpyInstance;
  let info: SpyInstance;

  afterEach(() => {
    jest.resetAllMocks();
  });

  beforeEach(() => {
    mockedFs.readdirSync.mockReturnValue([
      {
        name: "sample.testrunner.json",
        isFile: () => true,
        isDirectory: () => false,
      } as unknown as fs.Dirent<Buffer>,
    ]);

    mockedFs.readFileSync.mockReturnValue(
      JSON.stringify({
        url: "http://demo",
        tests: [
          {
            name: "My first test",
            steps: [{ action: "do something", expectedResult: "works" }],
          },
        ],
      }),
    );

    setFailed = jest.spyOn(core, "setFailed").mockImplementation(jest.fn());
    info = jest.spyOn(core, "info").mockImplementation(jest.fn());
    jest.spyOn(core, "getInput").mockImplementation((name: string) => {
      switch (name) {
        case "test-runner-url":
          return "http://fake-runner";
        case "test-runner-api-key":
          return "FAKE_KEY";
        case "directory":
          return "/tests";
        default:
          return "";
      }
    });
  });

  it("should succeed when test run finishes with SUCCESS", async () => {
    MockedAstrisClient.mockImplementation(() => ({
      addTestRun: jest.fn().mockResolvedValue("RUN_ID"),
      getTestRunFullStatus: jest
        .fn()
        .mockResolvedValueOnce({
          status: RunStatus.RUNNING,
          stepStatuses: [],
        })
        .mockResolvedValueOnce({
          status: RunStatus.SUCCESS,
          stepStatuses: [],
        }),
    }));

    await run();

    expect(setFailed).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith("✅ All tests succeeded");
  });

  it("should fail when test run finishes with ERROR", async () => {
    MockedAstrisClient.mockImplementation(() => ({
      addTestRun: jest.fn().mockResolvedValue("FAKE_RUN_ID"),
      getTestRunFullStatus: jest
        .fn()
        .mockResolvedValue({ status: RunStatus.ERROR, stepStatuses: [] }),
    }));

    await run();

    expect(setFailed).toHaveBeenCalledWith(
      expect.stringContaining("❌ 1 test(s) failed"),
    );
  });
});
