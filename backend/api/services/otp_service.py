import time
import pyotp
import qrcode
import base64
from io import BytesIO


def obtener_tiempo_ntp():
    try:
        import ntplib
        client = ntplib.NTPClient()
        response = client.request('pool.ntp.org', timeout=3)
        return response.tx_time
    except Exception:
        return time.time()


def generate_2fa_qr(username):
    secret = pyotp.random_base32()

    otp_uri = pyotp.totp.TOTP(secret).provisioning_uri(
        name=username,
        issuer_name="ArchivoSys"
    )

    img = qrcode.make(otp_uri)

    buffer = BytesIO()
    img.save(buffer, format="PNG")

    qr_base64 = base64.b64encode(buffer.getvalue()).decode()

    return secret, f"data:image/png;base64,{qr_base64}"