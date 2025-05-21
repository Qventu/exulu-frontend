export function TruncatedText({ text, length }: { text: string, length: number }) {
    if (text.length > length) {
        return <>{text.slice(0, length)}...</>
    } else {
        return <>{text}</>;
    }
}