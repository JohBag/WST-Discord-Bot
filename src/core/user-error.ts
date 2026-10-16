// An error whose message is safe and useful to show to the user who triggered it
export default class UserError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UserError';
	}
}
