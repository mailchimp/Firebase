jest.mock("@mailchimp/mailchimp_marketing");

const functions = require("firebase-functions-test");
const admin = require("firebase-admin");
const mailchimp = require("@mailchimp/mailchimp_marketing");
const { errorWithStatus, defaultConfig } = require("./utils");

const testEnv = functions();

// configure config mocks (so we can inject config and try different scenarios)
jest.doMock("../../config", () => defaultConfig);
const api = require("../../index");

describe("mergeFieldsHandler", () => {
  const configureApi = (config) => {
    api.processConfig(config);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mailchimp.lists.setListMember = jest.fn();
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

    expect(result).toBe(undefined);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(0);
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

    expect(result).toBe(undefined);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(0);
  });

  it("should make no calls with invalid mergeFields", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: { field1: "value" },
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(0);
  });

  it("should make no calls with invalid statusField", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
          phoneNumber: "PHONE",
        },
        statusField: {
          field1: "value",
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(0);
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(0);
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
          PHONE: "new phone number",
        },
        status_if_new: "mailchimpContactStatus",
      },
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
    mailchimp.lists.setListMember.mockImplementation(() => {
      throw errorWithStatus(404);
    });

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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(retryAttempts + 1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
          PHONE: "new phone number",
        },
        status_if_new: "mailchimpContactStatus",
      },
    );
  });

  it("should set data for user when new value only", async () => {
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
          PHONE: "new phone number",
        },
        status_if_new: "mailchimpContactStatus",
      },
    );
  });

  it("should set data for user when old value only", async () => {
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
      phoneNumber: "old phone number",
      emailAddress: "test@example.com",
    };
    const afterUser = {
      uid: "122",
      displayName: "lee",
      firstName: "new first name",
      lastName: "new last name",
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
          PHONE: "",
        },
        status_if_new: "mailchimpContactStatus",
      },
    );
  });

  it("should set data for user when changed boolean only", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
          hasThing: "HAS_THING",
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
      hasThing: true,
      emailAddress: "test@example.com",
    };
    const afterUser = {
      uid: "122",
      displayName: "lee",
      firstName: "new first name",
      lastName: "new last name",
      hasThing: false,
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
          HAS_THING: false,
        },
        status_if_new: "mailchimpContactStatus",
      },
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
          PHONE: "new phone number",
        },
        status_if_new: "mailchimpContactStatus",
      },
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
          PHONE: "new phone number",
        },
        status_if_new: "mailchimpContactStatus",
      },
    );
  });

  it("should set data with complex field config for user", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: {
            mailchimpFieldName: "FNAME",
          },
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
          PHONE: "new phone number",
        },
        status_if_new: "mailchimpContactStatus",
      },
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
        },
        status_if_new: "mailchimpContactStatus",
      },
    );
  });

  it("should use JMESPath query", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
          "data[?field=='phoneNumber'].value | [0]": "PHONE",
          "history[0].key": "LATEST_CHANGE",
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      firstName: "first name",
      lastName: "last name",
      data: [
        {
          field: "phoneNumber",
          value: "old phone number",
        },
        {
          field: "country",
          value: "Australia",
        },
      ],
      history: [
        {
          key: "firstName",
          to: "Some other first name",
        },
      ],
      emailAddress: "test@example.com",
    };
    const afterUser = {
      uid: "122",
      displayName: "lee",
      firstName: "first name",
      lastName: "last name",
      data: [
        {
          field: "phoneNumber",
          value: "new phone number",
        },
        {
          field: "country",
          value: "New Zealand",
        },
      ],
      history: [
        {
          key: "lastName",
          to: "Some other name",
        },
        {
          key: "firstName",
          to: "Some other last name",
        },
      ],
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          PHONE: "new phone number",
          LATEST_CHANGE: "lastName",
        },
        status_if_new: "mailchimpContactStatus",
      },
    );
  });

  it("should always push data for fields with when=always configuration for user", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: {
            mailchimpFieldName: "FNAME",
            when: "always",
          },
          lastName: "LNAME",
          phoneNumber: {
            mailchimpFieldName: "PHONE",
            when: "changed",
          },
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      firstName: "first name",
      lastName: "old last name",
      phoneNumber: "existing phone number",
      emailAddress: "test@example.com",
    };
    const afterUser = {
      uid: "122",
      displayName: "lee",
      firstName: "first name",
      lastName: "new last name",
      phoneNumber: "existing phone number",
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "first name",
          LNAME: "new last name",
        },
        status_if_new: "mailchimpContactStatus",
      },
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test2@example.com",
        merge_fields: {
          EMAIL: "test2@example.com",
          FNAME: "new first name",
          LNAME: "new last name",
        },
        status_if_new: "mailchimpContactStatus",
      },
    );
  });

  it("should update the status of the user, with no transformation", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
        },
        statusField: {
          documentPath: "statusField",
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const beforeUser = {
      uid: "122",
      firstName: "first name",
      lastName: "last name",
      statusField: "transactional",
      emailAddress: "test@example.com",
    };
    const afterUser = {
      uid: "122",
      firstName: "first name",
      lastName: "last name",
      statusField: "pending",
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        status: "pending",
        status_if_new: "pending",
      },
    );
  });

  it("should update the status of the user, with boolean transformation to subscribed", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
        },
        statusField: {
          documentPath: "subscribed",
          statusFormat: "boolean",
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const beforeUser = {
      uid: "122",
      firstName: "first name",
      lastName: "last name",
      subscribed: false,
      emailAddress: "test@example.com",
    };
    const afterUser = {
      uid: "122",
      firstName: "first name",
      lastName: "last name",
      subscribed: true,
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        status: "subscribed",
        status_if_new: "subscribed",
      },
    );
  });

  it("should update the status of the user, with boolean transformation to unsubscribed", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
        },
        statusField: {
          documentPath: "subscribed",
          statusFormat: "boolean",
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const beforeUser = {
      uid: "122",
      firstName: "first name",
      lastName: "last name",
      subscribed: true,
      emailAddress: "test@example.com",
    };
    const afterUser = {
      uid: "122",
      firstName: "first name",
      lastName: "last name",
      subscribed: false,
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
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        status: "unsubscribed",
        status_if_new: "unsubscribed",
      },
    );
  });

  it("should set data for user with hyphenated field", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          "\"last-name\"": "LNAME",
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
      "last-name": "new last name",
      phoneNumber: "new phone number",
      emailAddress: "test@example.com",
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "new first name",
          LNAME: "new last name",
          PHONE: "new phone number",
        },
        status_if_new: "mailchimpContactStatus",
      },
    );
  });

  it("should set address data for user when using nested field names", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
          phoneNumber: "PHONE",
          addressLine1: "ADDRESS.addr1",
          addressLine2: "ADDRESS.addr2",
          addressCity: "ADDRESS.city",
          addressState: "ADDRESS.state",
          addressZip: "ADDRESS.zip",
          addressCountry: "ADDRESS.country",
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
      firstName: "first name",
      lastName: "last name",
      phoneNumber: "phone number",
      emailAddress: "test@example.com",
      addressLine1: "Line 1",
      addressLine2: "Line 2",
      addressCity: "City",
      addressState: "State",
      addressZip: "Zip",
      addressCountry: "Country",
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "first name",
          LNAME: "last name",
          PHONE: "phone number",
          ADDRESS: {
            addr1: "Line 1",
            addr2: "Line 2",
            city: "City",
            country: "Country",
            state: "State",
            zip: "Zip",
          },
        },
        status_if_new: "mailchimpContactStatus",
      },
    );
  });

  it("should convert timestamp to date", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
          phoneNumber: "PHONE",
          createdDate: {
            mailchimpFieldName: "CREATED_AT",
            typeConversion: "timestampToDate",
          },
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
      firstName: "first name",
      lastName: "last name",
      phoneNumber: "phone number",
      emailAddress: "test@example.com",
      createdDate: new admin.firestore.Timestamp(1692572400, 233000000),
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "first name",
          LNAME: "last name",
          PHONE: "phone number",
          CREATED_AT: "2023-08-20",
        },
        status_if_new: "mailchimpContactStatus",
      },
    );
  });

  it("should fail timestamp conversion if type is incorrect", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
          phoneNumber: "PHONE",
          createdDate: {
            mailchimpFieldName: "CREATED_AT",
            typeConversion: "timestampToDate",
          },
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
      firstName: "first name",
      lastName: "last name",
      phoneNumber: "phone number",
      emailAddress: "test@example.com",
      createdDate: "1692572400",
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimp.lists.setListMember).not.toHaveBeenCalled();
  });

  it("should convert number string to number", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
          phoneNumber: "PHONE",
          eventCount: {
            mailchimpFieldName: "EVENT_COUNT",
            typeConversion: "stringToNumber",
          },
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
      firstName: "first name",
      lastName: "last name",
      phoneNumber: "phone number",
      emailAddress: "test@example.com",
      eventCount: "3.45",
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.setListMember).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        email_address: "test@example.com",
        merge_fields: {
          FNAME: "first name",
          LNAME: "last name",
          PHONE: "phone number",
          EVENT_COUNT: 3.45,
        },
        status_if_new: "mailchimpContactStatus",
      },
    );
  });

  it("should fail string to number conversion", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMergeField: JSON.stringify({
        mergeFields: {
          firstName: "FNAME",
          lastName: "LNAME",
          phoneNumber: "PHONE",
          eventCount: {
            mailchimpFieldName: "EVENT_COUNT",
            typeConversion: "stringToNumber",
          },
        },
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.mergeFieldsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
      firstName: "first name",
      lastName: "last name",
      phoneNumber: "phone number",
      emailAddress: "test@example.com",
      eventCount: "test",
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimp.lists.setListMember).not.toHaveBeenCalled();
  });
});
