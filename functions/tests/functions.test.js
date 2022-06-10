const functions = require("firebase-functions-test");
const testEnv = functions();

// default configuration for testing
const defaultConfig = {
  location: "location",
  mailchimpOAuthToken: "mailchimpOAuthToken",
  mailchimpAudienceId: "mailchimpAudienceId",
  mailchimpContactStatus: "mailchimpContactStatus",
  mailchimpMemberTagsWatchPath: "_unused_",
  mailchimpMemberTags: "{}",
  mailchimpMergeFieldWatchPath: "_unused_",
  mailchimpMergeField: "{}",
  mailchimpMemberEventsWatchPath: "_unused_",
  mailchimpMemberEvents: "{}",
};

// configure mailchimp mocks (so we can test the right things were sent)
const mailchimpMocks = { post: jest.fn(), put: jest.fn() };
const mailchimp = jest.fn().mockImplementation(() => {
  return mailchimpMocks;
});
jest.mock("mailchimp-api-v3", () => mailchimp);

// configure config mocks (so we can inject config and try different scenarios)
jest.mock("../config", () => defaultConfig);

const api = require("../index");

describe("firebase functions", () => {
  let configureApi = (config) => {
    api.processConfig(config);
  };

  beforeEach(() => {
    Object.values(mailchimpMocks).forEach((value) => value.mockClear());
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  describe("memberTagsHandler", () => {
    it("should make no calls with empty config", async () => {
      configureApi(defaultConfig);
      const wrapped = testEnv.wrap(api.memberTagsHandler);

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
      expect(mailchimpMocks.post).toHaveBeenCalledTimes(0);
    });

    it("should make no calls when subscriberEmail field not found in document", async () => {
      configureApi({
        ...defaultConfig,
        mailchimpMemberTags: JSON.stringify({
          memberTags: ["tag_data_1"],
          subscriberEmail: "email",
        }),
      });
      const wrapped = testEnv.wrap(api.memberTagsHandler);

      const testUser = {
        displayName: "lee",
        tag_data_1: "tagValue1",
        tag_data_2: "tagValue2",
      };

      const result = await wrapped({
        after: {
          data: () => testUser,
        },
      });

      expect(result).toBe(undefined);
      expect(mailchimpMocks.post).toHaveBeenCalledTimes(0);
    });

    it("should set tags for new user", async () => {
      configureApi({
        ...defaultConfig,
        mailchimpMemberTags: JSON.stringify({
          memberTags: ["tag_data_1", "tag_data_2"],
          subscriberEmail: "emailAddress",
        }),
      });
      const wrapped = testEnv.wrap(api.memberTagsHandler);

      const testUser = {
        uid: "122",
        displayName: "lee",
        emailAddress: "test@example.com",
        tag_data_1: "tagValue1",
        tag_data_2: "tagValue2",
      };

      const result = await wrapped({
        after: {
          data: () => testUser,
        },
      });

      expect(result).toBe(undefined);
      expect(mailchimpMocks.post).toHaveBeenCalledWith(
        "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/tags",
        {
          tags: [
            { name: "tagValue1", status: "active" },
            { name: "tagValue2", status: "active" },
          ],
        }
      );
    });

    it("should set tags for new user with nested subscriber email", async () => {
      configureApi({
        ...defaultConfig,
        mailchimpMemberTags: JSON.stringify({
          memberTags: ["tag_data_1", "tag_data_2"],
          subscriberEmail: "contactInfo.emailAddress",
        }),
      });
      const wrapped = testEnv.wrap(api.memberTagsHandler);

      const testUser = {
        uid: "122",
        displayName: "lee",
        contactInfo: {
          emailAddress: "test@example.com",
        },
        tag_data_1: "tagValue1",
        tag_data_2: "tagValue2",
      };

      const result = await wrapped({
        after: {
          data: () => testUser,
        },
      });

      expect(result).toBe(undefined);
      expect(mailchimpMocks.post).toHaveBeenCalledWith(
        "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/tags",
        {
          tags: [
            { name: "tagValue1", status: "active" },
            { name: "tagValue2", status: "active" },
          ],
        }
      );
    });

    it("should set tags from nested config for new user", async () => {
      configureApi({
        ...defaultConfig,
        mailchimpMemberTags: JSON.stringify({
          memberTags: ["tag_data.field_1", "tag_data.field_2"],
          subscriberEmail: "emailAddress",
        }),
      });
      const wrapped = testEnv.wrap(api.memberTagsHandler);

      const testUser = {
        uid: "122",
        displayName: "lee",
        emailAddress: "test@example.com",
        tag_data: {
          field_1: "tagValue1",
          field_2: "tagValue2",
        },
      };

      const result = await wrapped({
        after: {
          data: () => testUser,
        },
      });

      expect(result).toBe(undefined);
      expect(mailchimpMocks.post).toHaveBeenCalledWith(
        "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/tags",
        {
          tags: [
            { name: "tagValue1", status: "active" },
            { name: "tagValue2", status: "active" },
          ],
        }
      );
    });

    it("should update tags for changed user", async () => {
      configureApi({
        ...defaultConfig,
        mailchimpMemberTags: JSON.stringify({
          memberTags: ["tag_data_1", "tag_data_2"],
          subscriberEmail: "emailAddress",
        }),
      });
      const wrapped = testEnv.wrap(api.memberTagsHandler);

      const existingUser = {
        uid: "122",
        displayName: "lee",
        emailAddress: "test@example.com",
        tag_data_1: "tagValue1",
        tag_data_2: "tagValue2",
      };

      const updatedUser = {
        uid: "122",
        displayName: "lee",
        emailAddress: "test@example.com",
        tag_data_1: "tagValue3",
        tag_data_2: "tagValue4",
      };

      const result = await wrapped({
        before: {
          data: () => existingUser,
        },
        after: {
          data: () => updatedUser,
        },
      });

      expect(result).toBe(undefined);
      expect(mailchimpMocks.post).toHaveBeenCalledWith(
        "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/tags",
        {
          tags: [
            { name: "tagValue1", status: "inactive" },
            { name: "tagValue2", status: "inactive" },
            { name: "tagValue3", status: "active" },
            { name: "tagValue4", status: "active" },
          ],
        }
      );
    });

    it("should update multiple tag fields", async () => {
      configureApi({
        ...defaultConfig,
        mailchimpMemberTags: `{ "memberTags": ["tag_field_1", "tag_field_2", "tag_field_3"], "subscriberEmail": "email"}`,
      });
      const wrapped = testEnv.wrap(api.memberTagsHandler);

      const existingUser = {
        uid: "122",
        displayName: "lee",
        email: "test@example.com",
      };

      const updatedUser = {
        uid: "122",
        displayName: "lee",
        email: "test@example.com",
        tag_field_1: "data_1",
        tag_field_2: ["data_2", "data_3"],
        tag_field_3: "data_4",
      };

      const result = await wrapped({
        before: {
          data: () => existingUser,
        },
        after: {
          data: () => updatedUser,
        },
      });

      expect(result).toBe(undefined);
      expect(mailchimpMocks.post).toHaveBeenCalledWith(
        "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/tags",
        {
          tags: [
            { name: "data_1", status: "active" },
            { name: "data_2", status: "active" },
            { name: "data_3", status: "active" },
            { name: "data_4", status: "active" },
          ],
        }
      );
    });
  });

  describe("mergeFieldsHandler", () => {
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
      expect(mailchimpMocks.post).toHaveBeenCalledTimes(0);
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
      expect(mailchimpMocks.post).toHaveBeenCalledTimes(0);
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
      expect(mailchimpMocks.put).toHaveBeenCalledWith(
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
      expect(mailchimpMocks.put).toHaveBeenCalledWith(
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
      expect(mailchimpMocks.put).toHaveBeenCalledWith(
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
      expect(mailchimpMocks.put).toHaveBeenCalledWith(
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
  });
});
