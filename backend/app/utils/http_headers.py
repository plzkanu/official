from urllib.parse import quote


def content_disposition(disposition: str, filename: str) -> str:
    """HTTP 헤더용 Content-Disposition (한글 파일명 RFC 5987)."""
    ascii_fallback = "".join(char if ord(char) < 128 else "_" for char in filename).strip("._")
    if not ascii_fallback:
        ascii_fallback = "download"

    if ascii_fallback == filename:
        return f'{disposition}; filename="{filename}"'

    encoded = quote(filename, safe="")
    return f'{disposition}; filename="{ascii_fallback}"; filename*=UTF-8\'\'{encoded}'
