const date = new Date(1654461927864);

function nth(n) { return ["st", "nd", "rd"][((n + 90) % 100 - 10) % 10 - 1] || "th" };

console.log(new Intl.DateTimeFormat('en-GB', { dateStyle: 'full' }).format(date));