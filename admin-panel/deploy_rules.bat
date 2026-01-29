@echo off
cls
echo ========================================================
echo   ASSISTENTE DE CONFIGURACAO - REDE CONECTA
echo ========================================================
echo.
echo Para que o sistema funcione, precisamos liberar o acesso
echo na sua conta Google.
echo.
echo 1. Uma janela do navegador vai abrir.
echo 2. Faca login com sua conta do Google/Gmail.
echo 3. Volte aqui quando terminar.
echo.
pause
echo.
echo Verificando login...
call firebase login
echo.
echo ========================================================
echo   ENVIANDO REGRAS PARA O SISTEMA...
echo ========================================================
echo.
call firebase deploy --only firestore:rules --project rede-conecta-local
echo.
echo ========================================================
echo   PRONTO!
echo   Se apareceu "Deploy complete" acima, pode fechar.
echo ========================================================
pause
