const functions = require("firebase-functions-test");
const defaultConfig = require("./utils").defaultConfig;
const testEnv = functions();
jest.mock('mailchimp-api-v3');

// configure config mocks (so we can inject config and try different scenarios)
jest.doMock("../config", () => defaultConfig);

const api = require("../index");

describe("memberTagsHandler", () => {
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
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledTimes(0);
  });

  it("should make no calls with config missing memberEvents", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberTags: JSON.stringify({
        subscriberEmail: "emailAddress",
      })
    });
    const wrapped = testEnv.wrap(api.memberTagsHandler);

    const testUser = {
      displayName: "lee",
      emailAddress: "email",
      tag_data_1: "tagValue1",
      tag_data_2: "tagValue2",
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(null);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledTimes(0);
  });

  it("should make no calls with config specifying invalid memberTags", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberTags: JSON.stringify({
        memberTags: [{ field1: "test"}],
        subscriberEmail: "emailAddress",
      })
    });
    const wrapped = testEnv.wrap(api.memberTagsHandler);

    const testUser = {
      displayName: "lee",
      emailAddress: "email",
      tag_data_1: "tagValue1",
      tag_data_2: "tagValue2",
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
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledTimes(0);
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
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith(
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
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith(
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
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith(
      "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/tags",
      {
        tags: [
          { name: "tagValue1", status: "active" },
          { name: "tagValue2", status: "active" },
        ],
      }
    );
  });

  it("should set tags from multidimensional nested config for new user", async () => {
        configureApi({
          ...defaultConfig,
          mailchimpMemberTags: JSON.stringify({
            memberTags: ["tag_data.field_1", { documentPath: "tag_data.field_2[*].value"}],
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
            field_2: [
              { label : "label_1", value: "value_1" },
              { label : "label_2", value: "value_2" },
              { label : "label_3", value: "value_3" },
            ],
          },
        };
    
        const result = await wrapped({
          after: {
            data: () => testUser,
          },
        });
    
        expect(result).toBe(undefined);
        expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith(
          "/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/tags",
          {
            tags: [
              { name: "tagValue1", status: "active" },
              { name: "value_1", status: "active" },
              { name: "value_2", status: "active" },
              { name: "value_3", status: "active" },
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
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith(
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

  it("should use old email for hash if email field changed", async () => {
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
      emailAddress: "test2@example.com",
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
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith(
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
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith(
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
