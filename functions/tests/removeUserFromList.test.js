const functions = require("firebase-functions-test");
const defaultConfig = require("./utils").defaultConfig;
const testEnv = functions();
jest.mock('mailchimp-api-v3');

// configure config mocks (so we can inject config and try different scenarios)
jest.mock("../config", () => defaultConfig);

const api = require("../index");

describe("removeUserFromList", () => {
  let mailchimpMock
  let configureApi = (config) => {
    api.processConfig(config);
  };

  beforeAll(() =>{
    mailchimpMock = require('mailchimp-api-v3')
  })

  beforeEach(() => {
    mailchimpMock.__clearMocks()
  });

  afterAll(() => {
    testEnv.cleanup();
  });


  it("should make no calls when email is not set", async () => {
    configureApi(defaultConfig);
    const wrapped = testEnv.wrap(api.removeUserFromList);

    const result = await wrapped({});

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledTimes(0);
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
    expect(mailchimpMock.__mocks.delete).toHaveBeenCalledWith(
      "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0"
    );
  });
});