const Validator = require("jsonschema").Validator;
const v = new Validator();

const multidimensionalSelectorSchema = {
  id: "/MultiDimensionalSelector",
  type: "object",
  properties: {
    documentPath: { type: "string" },
    valueSelector: { type: "string" },
  },
  required: ["documentPath"],
};

const tagConfigSchema = {
  id: "/TagConfig",
  type: "object",
  properties: {
    memberTags: {
      type: "array",
      items: {
        oneOf: [
          { type: "string" },
          { $ref: multidimensionalSelectorSchema.id },
        ],
      },
    },
    subscriberEmail: { type: "string" },
  },
  required: ["memberTags", "subscriberEmail"],
};

const eventsConfigSchema = {
  id: "/EventsConfig",
  type: "object",
  properties: {
    memberEvents: {
      type: "array",
      items: {
        oneOf: [
          { type: "string" },
          { $ref: multidimensionalSelectorSchema.id },
        ],
      },
    },
    subscriberEmail: { type: "string" },
  },
  required: ["memberEvents", "subscriberEmail"],
};

const mergeFieldsConfigSchema = {
  id: "/MergeFieldsConfig",
  type: "object",
  properties: {
    mergeFields: {
      type: "object",
      additionalProperties: { type: "string" }
    },
    subscriberEmail: { type: "string" },
  },
  required: ["mergeFields", "subscriberEmail"],
};

v.addSchema(multidimensionalSelectorSchema, multidimensionalSelectorSchema.id);

exports.validateTagConfig = (tagConfig) =>
  v.validate(tagConfig, tagConfigSchema);
exports.validateEventsConfig = (eventsConfig) =>
  v.validate(eventsConfig, eventsConfigSchema);
exports.validateMergeFieldsConfig = (mergeFieldsConfig) =>
  v.validate(mergeFieldsConfig, mergeFieldsConfigSchema);
