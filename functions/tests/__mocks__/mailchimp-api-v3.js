
const mailchimpMocks = { post: jest.fn(), put: jest.fn() };
const mailchimpMock = jest.fn().mockImplementation(() => {
  return mailchimpMocks;
});

const mailchimpApiV3 = jest.fn().mockImplementation(() => {
  return mailchimpMocks;
});

mailchimpApiV3.__clearMocks = () => {
    Object.values(mailchimpMocks).forEach((value) => value.mockClear());
}
mailchimpApiV3.__mocks = mailchimpMocks

module.exports = mailchimpApiV3;
