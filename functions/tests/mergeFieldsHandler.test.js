const functions = require("firebase-functions-test");
const defaultConfig = require("./utils").defaultConfig;
const testEnv = functions();
jest.mock("mailchimp-api-v3");

// configure config mocks (so we can inject config and try different scenarios)
jest.mock("../config", () => defaultConfig);

const api = require("../index");

describe("mergeFieldsHandler", () => {
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

  it("should make no calls with empty config", async () => {
    configureApi(defaultConfig);
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(null);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledTimes(0);
  });

  it("should make no calls with missing mergeFields", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
      firstName: "new first name",
      lastName: "new last name",
      phoneNumber: "new phone number",
      emailAddress: "test@example.com",
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(null);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledTimes(0);
  });

  it("should make no calls with invalid mergeFields", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: { field1: "value"}
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
      firstName: "new first name",
      lastName: "new last name",
      phoneNumber: "new phone number",
      emailAddress: "test@example.com",
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(null);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledTimes(0);
  });

  it("should make no calls when subscriberEmail field not found in document", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
          phoneNumber: "PHONE",
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
      firstName: "new first name",
      lastName: "new last name",
      phoneNumber: "new phone number",
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledTimes(0);
  });

  it("should set data for user", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
          phoneNumber: "PHONE",
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
      firstName: "new first name",
      lastName: "new last name",
      phoneNumber: "new phone number",
      emailAddress: "test@example.com",
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.put).toHaveBeenCalledWith(
      "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
          PHONE: "new phone number",
        },
        status_if_new: "mailchimpContactStatus",
      }
    );
  });

  it("should set data for user with nested subscriber email", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
          phoneNumber: "PHONE",
        },
        subscriberEmail: "contactInfo.emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
      firstName: "new first name",
      lastName: "new last name",
      phoneNumber: "new phone number",
      contactInfo: {
        emailAddress: "test@example.com",
      },
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.put).toHaveBeenCalledWith(
      "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
          PHONE: "new phone number",
        },
        status_if_new: "mailchimpContactStatus",
      }
    );
  });

  it("should set data from nested config for user", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          "userData.firstName": "FNAME",
          "userData.lastName": "LNAME",
          "userData.phoneNumber": "PHONE",
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
      userData: {
        firstName: "new first name",
        lastName: "new last name",
        phoneNumber: "new phone number",
      },
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.put).toHaveBeenCalledWith(
      "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
          PHONE: "new phone number",
        },
        status_if_new: "mailchimpContactStatus",
      }
    );
  });

  it("should update data selectively for user", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
          phoneNumber: "PHONE",
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      firstName: "old first name",
      lastName: "old last name",
      phoneNumber: "new phone number",
      emailAddress: "test@example.com",
    };
    const afterUser = {
      uid: "122",
      displayName: "lee",
      firstName: "new first name",
      lastName: "new last name",
      phoneNumber: "new phone number",
      emailAddress: "test@example.com",
    };

    const result = await wrapped({
      before: {
        data: () => beforeUser,
      },
      after: {
        data: () => afterUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.put).toHaveBeenCalledWith(
      "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
        },
        status_if_new: "mailchimpContactStatus",
      }
    );
  });

  it("should update email address for user", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          emailAddress: "EMAIL",
          firstName: "FNAME",
          lastName: "LNAME",
          phoneNumber: "PHONE",
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      firstName: "old first name",
      lastName: "old last name",
      phoneNumber: "new phone number",
      emailAddress: "test@example.com",
    };
    const afterUser = {
      uid: "122",
      displayName: "lee",
      firstName: "new first name",
      lastName: "new last name",
      phoneNumber: "new phone number",
      emailAddress: "test2@example.com",
    };

    const result = await wrapped({
      before: {
        data: () => beforeUser,
      },
      after: {
        data: () => afterUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.put).toHaveBeenCalledWith(
      "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test2@example.com",
        merge_fields: {
          EMAIL: "test2@example.com",
          FNAME: "new first name",
          LNAME: "new last name",
        },
        status_if_new: "mailchimpContactStatus",
      }
    );
  });
});
