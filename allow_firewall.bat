@echo off
netsh advfirewall firewall add rule name="Menu Server 3000" dir=in action=allow protocol=TCP localport=3000
echo.
echo ✅ تم فتح المنفذ 3000 في جدار الحماية
echo الآن جرب تفتح الموقع من هاتفك على http://192.168.1.136:3000
pause
