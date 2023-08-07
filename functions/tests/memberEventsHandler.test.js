jest.mock("@mailchimp/mailchimp_marketing");

const functions = require("firebase-functions-test");
const mailchimp = require("@mailchimp/mailchimp_marketing");
const { errorWithStatus, defaultConfig } = require("./utils");

const testEnv = functions();

// configure config mocks (so we can inject config and try different scenarios)
jest.doMock("../config", () => defaultConfig);

const api = require("../index");

describe("memberEventsHandler", () => {
  const configureApi = (config) => {
    api.processConfig(config);
  };

  beforeAll(() => { });

  beforeEach(() => {
    jest.clearAllMocks();
    mailchimp.lists.createListMemberEvent = jest.fn();
  });

  afterAll(() => {
    testEnv.cleanup();
  });

  it("should make no calls with empty config", async () => {
    configureApi(defaultConfig);
    const wrapped = testEnv.wrap(api.memberEventsHandler);

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
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledTimes(0);
  });

  it("should make no calls with config missing memberEvents", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

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
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledTimes(0);
  });

  it("should make no calls with config specifying invalid memberEvents", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: [{ field1: "test" }],
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    const testUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "email",
    };

    const result = await wrapped({
      after: {
        data: () => testUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledTimes(0);
  });

  it.each`
  retryAttempts
  ${0}
  ${2}
  `("should retry '$retryAttempts' times on operation error", async ({ retryAttempts }) => {
    configureApi({
      ...defaultConfig,
      mailchimpRetryAttempts: retryAttempts.toString(),
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events"],
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    mailchimp.lists.createListMemberEvent.mockImplementation(() => {
      throw errorWithStatus(404);
    });

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
    };

    const afterUser = {
      ...beforeUser,
      events: "my string event",
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
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledTimes(retryAttempts + 1);
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event",
      },
    );
  }, 10000);

  it("should add string events when none were existing", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events"],
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
    };

    const afterUser = {
      ...beforeUser,
      events: "my string event",
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
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event",
      },
    );
  });

  it("should add array events when none were existing", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events"],
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
    };

    const afterUser = {
      ...beforeUser,
      events: ["my string event"],
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
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event",
      },
    );
  });

  it("should add string events from multiple fields when none were existing", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events1", "events2"],
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
    };

    const afterUser = {
      ...beforeUser,
      events1: "my string event 1",
      events2: "my string event 2",
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
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledTimes(2);
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event 1",
      },
    );
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event 2",
      },
    );
  });

  it("should add array of events from multiple fields when none were existing", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events1", "events2"],
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
    };

    const afterUser = {
      ...beforeUser,
      events1: ["my string event 1"],
      events2: ["my string event 2"],
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
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledTimes(2);
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event 1",
      },
    );
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event 2",
      },
    );
  });

  it("should ignore previously sent string field events", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events1", "events2"],
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
      events1: "my string event 1",
      events2: "my string event 2",
    };

    const afterUser = {
      ...beforeUser,
      events1: "my string event 3",
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
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledTimes(1);
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event 3",
      },
    );
  });

  it("should ignore previously sent string field events", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events1", "events2"],
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
      events1: ["my string event 1"],
      events2: ["my string event 2"],
    };

    const afterUser = {
      ...beforeUser,
      events1: ["my string event 1", "my string event 3"],
      events2: ["my string event 4"],
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
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledTimes(2);
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event 3",
      },
    );
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event 4",
      },
    );
  });

  it("should use verbose config to determine events", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: [
          "events1",
          { documentPath: "events2" },
          { documentPath: "events3[*].eventKey" },
        ],
        subscriberEmail: "emailAddress",
      }),
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
      events1: ["my string event 1"],
      events2: ["my string event 2"],
      events3: [
        { eventKey: "my string event 3" },
        { eventKey: "my string event 4" },
      ],
    };

    const afterUser = {
      ...beforeUser,
      events1: ["my string event 1", "my string event 5"],
      events2: ["my string event 6"],
      events3: [
        { eventKey: "my string event 3" },
        { eventKey: "my string event 7" },
      ],
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
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledTimes(3);
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event 5",
      },
    );
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event 6",
      },
    );
    expect(mailchimp.lists.createListMemberEvent).toHaveBeenCalledWith(
      "mailchimpAudienceId",
      "55502f40dc8b7c769880b10874abc9d0",
      {
        name: "my string event 7",
      },
    );
  });
});
