const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { MercadoPagoConfig, Preference } = require('mercadopago');

admin.initializeApp();

// Configuração do Mercado Pago (Token será configurado via variáveis de ambiente)
// Ex: firebase functions:config:set mp.token="SEU_TOKEN"
const mpToken = functions.config().mp?.token || "TEST-8719543884841968-012809-5c4d3b6b1d4a8e2e9c1d3f4a3e2b1a0d-12345678"; // Token de Teste
const client = new MercadoPagoConfig({ accessToken: mpToken });

/**
 * Cria uma preferência de pagamento (Checkout)
 */
exports.createPreference = functions.https.onCall(async (data, context) => {
    // 1. Verificar autenticação
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuário não autenticado.');
    }

    const { amount, description } = data;
    const uid = context.auth.uid;

    try {
        const preference = new Preference(client);

        const response = await preference.create({
            body: {
                items: [
                    {
                        id: 'token-topup',
                        title: description || `Recarga de ${amount} tokens`,
                        quantity: 1,
                        unit_price: Number(amount), // R$ 1,00 por token (ajustável)
                        currency_id: 'BRL'
                    }
                ],
                payer: {
                    email: context.auth.token.email
                },
                metadata: {
                    uid: uid,
                    amount: amount
                },
                notification_url: "https://seu-dominio.web.app/api/notifications", // Webhook
                back_urls: {
                    success: "https://seu-dominio.web.app/finance?status=success",
                    failure: "https://seu-dominio.web.app/finance?status=failure",
                    pending: "https://seu-dominio.web.app/finance?status=pending"
                },
                auto_return: "approved"
            }
        });

        return { id: response.id, init_point: response.init_point };
    } catch (error) {
        console.error("MercadoPago Error:", error);
        throw new functions.https.HttpsError('internal', 'Erro ao criar preferência de pagamento.');
    }
});

/**
 * Webhook para receber notificações de pagamento do Mercado Pago
 */
exports.mercadopagoWebhook = functions.https.onRequest(async (req, res) => {
    const { action, data } = req.body;

    if (action === "payment.created" || action === "payment.updated") {
        const paymentId = data.id;

        // Aqui buscaríamos o status do pagamento no Mercado Pago e atualizaríamos o Firestore
        // Por agora, apenas registramos a intenção
        console.log(`Payment Notification received: ${paymentId}`);
    }

    res.status(200).send("OK");
});
