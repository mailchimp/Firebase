const functions = require("firebase-functions-test");
const defaultConfig = require("./utils").defaultConfig;
const testEnv = functions();
jest.mock("mailchimp-api-v3");

// configure config mocks (so we can inject config and try different scenarios)
jest.doMock("../config", () => defaultConfig);

const api = require("../index");

describe("addUserToList", () => {
  let mailchimpMock;
  let configureApi = (config) => {
    api.processConfig(config);
  };

  beforeAll(() => {
    mailchimpMock = require("mailchimp-api-v3");
  });

  beforeEach(() => {
    mailchimpMock.__clearMocks();
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  it("should make no calls when email is not set", async () => {
    configureApi(defaultConfig);
    const wrapped = testEnv.wrap(api.addUserToList);

    const result = await wrapped({});

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledTimes(0);
  });

  it("should post user when email is given", async () => {
    configureApi(defaultConfig);
    const wrapped = testEnv.wrap(api.addUserToList);

    const testUser = {
      uid: "122",
      email: "test@example.com",
    };

    mailchimpMock.__mocks.post.mockReturnValue({
        id: 'createdUserId'
    })

    const result = await wrapped(testUser);

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith(
      "/lists/mailchimpAudienceId/members",
      {
        email_address: "test@example.com",
        status: "mailchimpContactStatus",
      }
    );
  });
});
