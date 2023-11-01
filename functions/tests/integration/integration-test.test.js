const path = require("path");
const { faker } = require("@faker-js/faker");
const firebase = require("firebase/app");
const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword } = require("firebase/auth");
const {
  getFirestore, connectFirestoreEmulator, addDoc, collection, updateDoc,
} = require("firebase/firestore");

// need to import environment variables so we can make calls to mailchimp to verify data
require("dotenv").config({
  path: path.resolve(__dirname, "extensions/mailchimp-firebase-sync.env"),
});
const { mailchimp, subscriberHasher } = require("./mailchimp");

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

const app = firebase.initializeApp({
  projectId: "demo-test",
  apiKey: "test",
});
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099");

const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);

describe("mailchimp-firebase-extension", () => {
  it("should create user without auth, update details from document, with custom merge fields and activity", async () => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const emailAddress = faker.internet.email({
      firstName: firstName.toLowerCase(),
      lastName: lastName.toLowerCase(),
      provider: "mailchimpfirebasesync.com",
    });
    // quirk with emulator where handlers are triggered sequentially,
    //  so retries don't work for operations
    // TODO: investigate requeueing invocations rather than performing a wait and a retry.
    const doc = await addDoc(collection(db, "test_collection"), {
      firstName,
      lastName,
      emailAddress,
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 3000);
    });
    await updateDoc(doc, {
      tag1: "tag1",
      tag2: "tag2",
      customMerge1: "Custom 1",
      customMerge2: "Custom 2",
      activity: ["Connected", "Requested-Help"],
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 5000);
    });
    const listMember = await mailchimp.lists
      .getListMember(process.env.MAILCHIMP_AUDIENCE_ID, subscriberHasher(emailAddress));
    expect(listMember).toEqual(expect.objectContaining({
      full_name: `${firstName} ${lastName}`,
      email_address: emailAddress,
      merge_fields: expect.objectContaining({
        MMERGE6: "Custom 1",
        MMERGE7: "Custom 2",
      }),
      status: "subscribed",
      tags: expect.arrayContaining([
        expect.objectContaining({ name: "tag2" }),
        expect.objectContaining({ name: "tag1" }),
      ]),
    }));
    const listMemberActivity = await mailchimp.lists
      .getListMemberActivityFeed(process.env.MAILCHIMP_AUDIENCE_ID, subscriberHasher(emailAddress), { activity_filters: ["event"] });
    expect(listMemberActivity.activity.length).toEqual(2);
    expect(listMemberActivity.activity)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ activity_type: "event", event_name: "Connected" }),
        expect.objectContaining({ activity_type: "event", event_name: "Requested-Help" }),
      ]));
  }, 15000);

  it("should create user with auth, update details from document, with custom merge fields and activity", async () => {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const emailAddress = faker.internet.email({
      firstName: firstName.toLowerCase(),
      lastName: lastName.toLowerCase(),
      provider: "mailchimpfirebasesync.com",
    });
    const password = faker.internet.password({ length: 6 });
    await createUserWithEmailAndPassword(auth, emailAddress, password);
    await addDoc(collection(db, "test_collection"), {
      firstName,
      lastName,
      emailAddress,
      tag1: "tag1",
      tag2: "tag2",
      customMerge1: "Custom 1",
      customMerge2: "Custom 2",
      activity: ["Connected", "Requested-Help"],
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 6000);
    });
    const listMember = await mailchimp.lists
      .getListMember(process.env.MAILCHIMP_AUDIENCE_ID, subscriberHasher(emailAddress));
    expect(listMember).toEqual(expect.objectContaining({
      full_name: `${firstName} ${lastName}`,
      email_address: emailAddress,
      merge_fields: expect.objectContaining({
        MMERGE6: "Custom 1",
        MMERGE7: "Custom 2",
      }),
      status: "subscribed",
      tags: expect.arrayContaining([
        expect.objectContaining({ name: "tag2" }),
        expect.objectContaining({ name: "tag1" }),
      ]),
    }));
    const listMemberActivity = await mailchimp.lists
      .getListMemberActivityFeed(process.env.MAILCHIMP_AUDIENCE_ID, subscriberHasher(emailAddress), { activity_filters: ["event"] });
    expect(listMemberActivity.activity.length).toEqual(2);
    expect(listMemberActivity.activity)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ activity_type: "event", event_name: "Connected" }),
        expect.objectContaining({ activity_type: "event", event_name: "Requested-Help" }),
      ]));
  }, 10000);
});
