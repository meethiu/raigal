export const fakeSecrets = () => ({
	aws: ["AKIA", "IOSFODNN7EXAMPLE"].join(""),
	github: ["ghp", "_", "0123456789abcdef0123456789abcdef0123"].join(""),
	slack: ["xox", "b-000000000000-000000000000-abcdefghijklmnopqrstuvwx"].join(""),
	dbUrl: ["postgres://admin:", "s3cr3tP4ssw0rd", "@db.example.com:5432/app"].join(""),
	password: ["correct-horse", "-battery-staple"].join(""),
	pem: [
		"-----BEGIN RSA PRIVATE KEY-----",
		"MIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Qu",
		"-----END RSA PRIVATE KEY-----",
	].join("\n"),
});
