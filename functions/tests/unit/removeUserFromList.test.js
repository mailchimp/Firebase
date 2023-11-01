jest.mock("@mailchimp/mailchimp_marketing");

const functions = require("firebase-functions-test");
const mailchimp = require("@mailchimp/mailchimp_marketing");
const { errorWithStatus, defaultConfig } = require("./utils");

const testEnv = functions();

// configure config mocks (so we can inject config and try different scenarios)
jest.doMock("../../config", () => defaultConfig);

const api = require("../../index");

describe("removeUserFromList", () => {
  const configureApi = (config) => {
    api.processConfig(config);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  it("should make no calls when email is not set", async () => {
    configureApi(defaultConfig);
    const wrapped = testEnv.wrap(api.removeUserFromList);

    const result = await wrapped({});

    expect(result).toBe(undefined);
    expect(mailchimp.lists.deleteListMember).toHaveBeenCalledTimes(0);
  });

  it("should delete user when email is given", async () => {
    configureApi(defaultConfig);
    const wrapped = testEnv.wrap(api.removeUserFromList);

    const testUser = {
      uid: "122",
      email: "test@example.com",
    };

    const result = await wrapped(testUser);

    expect(result).toBe(undefined);
    expect(mailchimp.lists.deleteListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.deleteListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
    );
  });

  it.each`
  retryAttempts
  ${0}
  ${2}
  `("should retry '$retryAttempts' times on operation error", async ({ retryAttempts }) => {
    configureApi({
      ...defaultConfig,
      mailchimpRetryAttempts: retryAttempts.toString(),
    });
    const wrapped = testEnv.wrap(api.removeUserFromList);
    mailchimp.lists.deleteListMember.mockImplementation(() => {
      throw errorWithStatus(404);
    });

    const testUser = {
      uid: "122",
      email: "test@example.com",
    };

    const result = await wrapped(testUser);

    expect(result).toBe(undefined);
    expect(mailchimp.lists.deleteListMember).toHaveBeenCalledTimes(retryAttempts + 1);
    expect(mailchimp.lists.deleteListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
    );
  });
});
