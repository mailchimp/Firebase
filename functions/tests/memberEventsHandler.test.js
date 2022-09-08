const functions = require("firebase-functions-test");
const defaultConfig = require("./utils").defaultConfig;
const testEnv = functions();
jest.mock('mailchimp-api-v3');

// configure config mocks (so we can inject config and try different scenarios)
jest.mock("../config", () => defaultConfig);

const api = require("../index");

describe("memberEventsHandler", () => {
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

    expect(result).toBe(null);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledTimes(0);
  });
  

  it("should add string events when none were existing", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events"],
        subscriberEmail: "emailAddress",
      })
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
    };

    const afterUser = {
      ...beforeUser,
      events: "my string event"
    }

    const result = await wrapped({
      before: {
        data: () => beforeUser,
      },
      after: {
        data: () => afterUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith("/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/events", {
      "name": "my string event",
    });
  });

  it("should add array events when none were existing", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events"],
        subscriberEmail: "emailAddress",
      })
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
    };

    const afterUser = {
      ...beforeUser,
      events: ["my string event"]
    }

    const result = await wrapped({
      before: {
        data: () => beforeUser,
      },
      after: {
        data: () => afterUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith("/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/events", {
      "name": "my string event",
    });
  });
  

  it("should add string events from multiple fields when none were existing", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events1", "events2"],
        subscriberEmail: "emailAddress",
      })
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
      events2: "my string event 2"
    }

    const result = await wrapped({
      before: {
        data: () => beforeUser,
      },
      after: {
        data: () => afterUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith("/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/events", {
      "name": "my string event 1",
    });
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith("/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/events", {
      "name": "my string event 2",
    });
  });

  it("should add array of events from multiple fields when none were existing", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events1", "events2"],
        subscriberEmail: "emailAddress",
      })
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
      events2: ["my string event 2"]
    }

    const result = await wrapped({
      before: {
        data: () => beforeUser,
      },
      after: {
        data: () => afterUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith("/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/events", {
      "name": "my string event 1",
    });
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith("/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/events", {
      "name": "my string event 2",
    });
  });

  it("should ignore previously sent string field events", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events1", "events2"],
        subscriberEmail: "emailAddress",
      })
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
      events1: "my string event 1",
      events2: "my string event 2"
    };

    const afterUser = {
      ...beforeUser,
      events1: "my string event 3",
    }

    const result = await wrapped({
      before: {
        data: () => beforeUser,
      },
      after: {
        data: () => afterUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith("/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/events", {
      "name": "my string event 3",
    });
  });

  it("should ignore previously sent string field events", async () => {
    configureApi({
      ...defaultConfig,
      mailchimpMemberEvents: JSON.stringify({
        memberEvents: ["events1", "events2"],
        subscriberEmail: "emailAddress",
      })
    });
    const wrapped = testEnv.wrap(api.memberEventsHandler);

    const beforeUser = {
      uid: "122",
      displayName: "lee",
      emailAddress: "test@example.com",
      events1: ["my string event 1"],
      events2: ["my string event 2"]
    };

    const afterUser = {
      ...beforeUser,
      events1: ["my string event 1", "my string event 3"],
      events2: ["my string event 4"]
    }

    const result = await wrapped({
      before: {
        data: () => beforeUser,
      },
      after: {
        data: () => afterUser,
      },
    });

    expect(result).toBe(undefined);
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith("/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/events", {
      "name": "my string event 3",
    });
    expect(mailchimpMock.__mocks.post).toHaveBeenCalledWith("/lists/mailchimpAudienceId/members/55502f40dc8b7c769880b10874abc9d0/events", {
      "name": "my string event 4",
    });
  });
});