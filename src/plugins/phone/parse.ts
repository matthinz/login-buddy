import { Message } from "../../types";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function parseMessage(pieces: string[], type: "sms" | "voice"): Message {
  const message: Partial<Message> = {
    type,
  };

  pieces.forEach((piece) => {
    const m = /^(To|Body|Sent at): (.*)/.exec(piece);
    if (!m) {
      return;
    }

    const [_, field, value] = m;

    switch (field) {
      case "To":
        message.to = value;
        break;
      case "Body":
        message.body = value;
        break;
      case "Sent at":
        message.time = parseTelephonyDebugDateTime(value);
        break;
    }
  });

  if (
    message.type == null ||
    message.to == null ||
    message.body == null ||
    message.time == null
  ) {
    throw new Error("Invalid message");
  }

  return message as Message;
}

export function parseTelephonyDebugDateTime(input: string): Date | undefined {
  const rx = new RegExp(
    `(${MONTHS.join("|")}) (\\d+), (\\d+) at (\\d+):(\\d+) (AM|PM)`
  );
  const m = rx.exec(input);

  if (!m) {
    return;
  }

  const [_, month, day, year, hour, minutes, ampm] = m;

  const timestamp = Date.UTC(
    parseInt(year, 10),
    MONTHS.indexOf(month),
    parseInt(day, 10),
    (parseInt(hour, 10) + (ampm === "PM" ? 12 : 0)) % 24,
    parseInt(minutes, 10),
    0,
    0
  );

  return new Date(timestamp);
}
