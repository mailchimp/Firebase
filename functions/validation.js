const { Validator } = require("jsonschema");

const v = new Validator();

const multidimensionalSelectorSchema = {
  id: "/MultiDimensionalSelector",
  title: "MultiDimensionalSelector",
  type: "object",
  properties: {
    documentPath: { type: "string" },
  },
  required: ["documentPath"],
};

const tagConfigSchema = {
  id: "/TagConfig",
  title: "TagConfig",
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
  title: "EventsConfig",
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

const mergeFieldsExtendedConfigSchema = {
  id: "/MergeFieldExtendedConfig",
  title: "MergeFieldExtendedConfig",
  type: "object",
  properties: {
    mailchimpFieldName: { type: "string" },
    typeConversion: { type: "string", enum: ["none", "timestampToDate", "stringToNumber"] },
    when: { type: "string", enum: ["changed", "always"] },
  },
  required: ["mailchimpFieldName"],
};

const mergeFieldsConfigSchema = {
  id: "/MergeFieldsConfig",
  title: "MergeFieldsConfig",
  type: "object",
  properties: {
    mergeFields: {
      type: "object",
      additionalProperties: {
        oneOf: [
          { type: "string" },
          { $ref: mergeFieldsExtendedConfigSchema.id },
        ],
      },
    },
    statusField: {
      type: "object",
      properties: {
        documentPath: { type: "string" },
        statusFormat: { type: "string", enum: ["boolean", "string"] },
      },
      required: ["documentPath"],
    },
    subscriberEmail: { type: "string" },
  },
  required: ["mergeFields", "subscriberEmail"],
};

const backfillConfigSchema = {
  id: "/BackfillConfig",
  title: "BackfillConfig",
  type: "object",
  properties: {
    sources: {
      type: "array",
      items: {
        enum: ["AUTH", "MERGE_FIELDS", "MEMBER_TAGS", "MEMBER_EVENTS"],
      },
    },
    events: {
      type: "array",
      items: {
        enum: ["INSTALL", "UPDATE", "CONFIGURE"],
      },
    },
  },
};

[
  mergeFieldsExtendedConfigSchema,
  multidimensionalSelectorSchema,
  backfillConfigSchema,
].forEach((schema) => {
  v.addSchema(schema, schema.id);
});

exports.validateTagConfig = (tagConfig) => v.validate(tagConfig, tagConfigSchema);
exports.validateEventsConfig = (eventsConfig) => v.validate(eventsConfig, eventsConfigSchema);
exports.validateMergeFieldsConfig = (mergeFieldsConfig) => v.validate(
  mergeFieldsConfig,
  mergeFieldsConfigSchema,
);
exports.validateBackfillConfig = (backfillConfig) => v.validate(
  backfillConfig,
  backfillConfigSchema,
);
