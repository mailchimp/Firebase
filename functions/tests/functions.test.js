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
    Object.entries(mailchimpMocks).forEach(([key, value]) => value.mockClear());
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

    it("should set tags for new user", async () => {
      configureApi({
        ...defaultConfig,
        mailchimpMemberTags: JSON.stringify({
          memberTags: ["tags_data"],
          subscriberEmail: "emailAddress",
        }),
      });
      const wrapped = testEnv.wrap(api.memberTagsHandler);

      const testUser = {
        uid: "122",
        displayName: "lee",
        emailAddress: "test@example.com",
        tags_data: {
          mytag1: "tagValue1",
          mytag2: "tagValue2",
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
            {
              name: { mytag1: "tagValue1", mytag2: "tagValue2" },
              status: "active",
            },
          ],
        }
      );
    });

    it("should update tags for changed user", async () => {
      configureApi({
        ...defaultConfig,
        mailchimpMemberTags: JSON.stringify({
          memberTags: ["tags_data"],
          subscriberEmail: "emailAddress",
        }),
      });
      const wrapped = testEnv.wrap(api.memberTagsHandler);

      const existingUser = {
        uid: "122",
        displayName: "lee",
        emailAddress: "test@example.com",
        tags_data: {
          mytag1: "tagValue1",
          mytag2: "tagValue2",
        },
      };

      const updatedUser = {
        uid: "122",
        displayName: "lee",
        emailAddress: "test@example.com",
        tags_data: {
          mytag1: "tagValue3",
          mytag2: "tagValue4",
        },
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
            {
              name: { mytag1: "tagValue1", mytag2: "tagValue2" },
              status: "inactive",
            },
            {
              name: { mytag1: "tagValue3", mytag2: "tagValue4" },
              status: "active",
            },
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
        }
      );
    });
  });
});
