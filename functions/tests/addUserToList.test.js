
const functions = require("firebase-functions-test");
const defaultConfig = require("./utils").defaultConfig;
const testEnv = functions();

const mailchimp = require( '@mailchimp/mailchimp_marketing');

jest.mock("@mailchimp/mailchimp_marketing", () => {
  const lists = jest.fn();

  lists.addListMember = jest.fn();
  return { lists };
} );


// configure config mocks (so we can inject config and try different scenarios)
jest.doMock("../config", () => defaultConfig);

const api = require("../index");

describe("addUserToList", () => {

  let configureApi = (config) => {
    api.processConfig(config);
  };

  beforeAll(() => {

  });

  beforeEach(() => {
    mailchimp.lists.mockClear();
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  it("should make no calls when email is not set", async () => {
    configureApi(defaultConfig);
    const wrapped = testEnv.wrap(api.addUserToList);

    const result = await wrapped({});

    expect(result).toBe(undefined);
    expect(mailchimp.lists.addListMember).toHaveBeenCalledTimes(0);

  });

  it("should post user when email is given", async () => {
    configureApi(defaultConfig);
    const wrapped = testEnv.wrap(api.addUserToList);

    const testUser = {
      uid: "122",
      email: "test@example.com",
    };

    mailchimp.lists.addListMember.mockReturnValue({
        id: 'createdUserId'
    })

    const result = await wrapped(testUser);

    expect(result).toBe(undefined);
    expect(mailchimp.lists.addListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.addListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      {
        email_address: "test@example.com",
        status: "mailchimpContactStatus",
      }
    );

  });
});
