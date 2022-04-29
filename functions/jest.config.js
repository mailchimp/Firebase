module.exports = {
	transform: {
		'^.+\\.tsx?$': 'ts-jest',
	},
	testRegex: '/tests/.*|(\\.|/)(test|spec)\\.(jsx?|tsx?)$',
	testPathIgnorePatterns: ['node_modules/'],
	moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
	testEnvironment: 'node',
}