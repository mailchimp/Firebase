const functions = require("firebase-functions-test");
const defaultConfig = require("./utils").defaultConfig;
const testEnv = functions();

const mailchimp = require( '@mailchimp/mailchimp_marketing');

jest.mock("@mailchimp/mailchimp_marketing", () => {
  const lists = jest.fn();

  lists.deleteListMember = jest.fn();
  const setConfig = jest.fn();
  return { lists, setConfig };
} );

// configure config mocks (so we can inject config and try different scenarios)
jest.doMock("../config", () => defaultConfig);

const api = require("../index");

describe("removeUserFromList", () => {
  let configureApi = (config) => {
    api.processConfig(config);
  };

  beforeAll(() =>{
  });

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
      "55502f40dc8b7c769880b10874abc9d0"
    );
  });
});