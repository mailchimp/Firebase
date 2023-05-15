const lists = jest.fn();

lists.addListMember = jest.fn();
lists.createListMemberEvent = jest.fn();
lists.updateListMemberTags = jest.fn();
lists.setListMember = jest.fn();
lists.deleteListMember = jest.fn();
const setConfig = jest.fn();
module.exports = { lists, setConfig };
