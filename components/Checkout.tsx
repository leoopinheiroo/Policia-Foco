
import React, { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';

interface CheckoutProps {
  initialPlan: 'MONTHLY' | 'ANNUAL';
  onPaymentComplete: () => void;
  onBack: () => void;
}

const stripePromise = loadStripe(
  (import.meta as any).env.VITE_STRIPE_PUBLISHABLE_KEY || 
  (import.meta as any).env.STRIPE_PUBLISHABLE_KEY || 
  ''
);

export const Checkout: React.FC<CheckoutProps> = ({ initialPlan, onPaymentComplete, onBack }) => {
  const [step, setStep] = useState<'DETAILS' | 'PROCESSING'>('DETAILS');
  const [selectedPlan, setSelectedPlan] = useState<'MONTHLY' | 'ANNUAL'>(initialPlan);
  const [loading, setLoading] = useState(false);

  const [selectedMethod, setSelectedMethod] = useState<'CARD' | 'BOLETO' | 'PIX'>('CARD');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage(null);
    setStep('PROCESSING');

    if (selectedMethod === 'PIX') {
      setStep('DETAILS');
      setLoading(false);
      // Aqui poderíamos abrir um modal ou apenas deixar as instruções na tela
      return;
    }

    try {
      const email = localStorage.getItem('PF_USER_EMAIL');
      if (!email) throw new Error('Email do usuário não encontrado. Faça login novamente.');

      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan: selectedPlan,
          email: email,
          method: selectedMethod // Enviamos o método preferido
        }),
      });

      const data = await response.json();

      if (response.ok && data.url) {
        window.location.href = data.url;
      } else {
        const msg = data.error || 'Falha ao iniciar sessão de pagamento.';
        setErrorMessage(msg);
        throw new Error(msg);
      }
    } catch (error: any) {
      console.error('Erro no checkout:', error);
      setStep('DETAILS');
      setLoading(false);
      if (!errorMessage) setErrorMessage(error.message);
    }
  };

  const planInfo = {
    MONTHLY: {
      name: "Recruta (Mensal)",
      price: 29.90,
      label: "Mensal"
    },
    ANNUAL: {
      name: "Elite (Anual)",
      price: 297.00,
      label: "Anual"
    }
  };

  if (step === 'PROCESSING') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6 text-white">
         <div className="w-24 h-24 border-8 border-white/5 border-t-yellow-500 rounded-full animate-spin mb-10"></div>
         <h2 className="text-4xl font-black tracking-tighter mb-4">VERIFICANDO PAGAMENTO</h2>
         <p className="text-slate-400 max-w-md font-medium">Estamos processando sua transação com segurança. Não feche esta janela.</p>
         <div className="mt-10 flex gap-4">
            <div className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black uppercase text-slate-500 border border-white/5">VISA/MC SECURE</div>
            <div className="px-4 py-2 bg-white/5 rounded-xl text-[10px] font-black uppercase text-slate-500 border border-white/5">PIX INSTANTÂNEO</div>
         </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
       <div className="flex-1 flex flex-col lg:flex-row max-w-6xl mx-auto w-full p-6 py-12 lg:py-24 gap-12">
          
          {/* Order Summary */}
          <div className="flex-1 lg:order-2">
             <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-200 sticky top-12">
                <div className="flex justify-between items-start mb-8">
                   <h2 className="text-2xl font-black tracking-tighter">Resumo da Ordem</h2>
                   <button 
                    onClick={onBack}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors"
                   >
                     Cancelar
                   </button>
                </div>
                
                <div className="flex justify-between items-center mb-6 pb-6 border-b border-slate-100">
                   <div>
                      <p className="font-black text-slate-900">{planInfo[selectedPlan].name}</p>
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Acesso Full + IA Ilimitada</p>
                   </div>
                   <p className="font-black">R$ {planInfo[selectedPlan].price.toFixed(2).replace('.', ',')}</p>
                </div>

                <div className="space-y-4 mb-10">
                   <div className="flex justify-between text-sm text-slate-500 font-medium">
                      <span>Subtotal</span>
                      <span>R$ {planInfo[selectedPlan].price.toFixed(2).replace('.', ',')}</span>
                   </div>
                   <div className="flex justify-between text-sm text-green-600 font-bold">
                      <span>Desconto de Lançamento</span>
                      <span>- R$ 0,00</span>
                   </div>
                   <div className="flex justify-between text-xl font-black pt-4 border-t border-slate-100">
                      <span>Total</span>
                      <span>R$ {planInfo[selectedPlan].price.toFixed(2).replace('.', ',')}</span>
                   </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl flex items-start gap-4 mb-8">
                   <div className="text-2xl">🔒</div>
                   <p className="text-xs text-slate-500 font-medium leading-relaxed">
                      Seu pagamento está 100% seguro. Utilizamos criptografia de 256 bits para proteger seus dados financeiros.
                   </p>
                </div>
             </div>
          </div>

          {/* Payment Details Form */}
          <div className="flex-[1.5] lg:order-1">
             <button 
               onClick={onBack}
               className="mb-6 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 flex items-center gap-2 transition-colors"
             >
               ← Voltar ao Início
             </button>
             <h2 className="text-4xl font-black tracking-tighter mb-10">Finalizar Assinatura</h2>
             
             {/* Plan Selection UI */}
             <div className="mb-12">
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-4 ml-1">Selecione seu Plano</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <button 
                      type="button"
                      onClick={() => setSelectedPlan('MONTHLY')}
                      className={`p-6 border-2 rounded-[2rem] flex flex-col text-left transition-all relative overflow-hidden
                        ${selectedPlan === 'MONTHLY' ? 'border-slate-950 bg-slate-950 text-white shadow-xl' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}
                      `}
                   >
                      <span className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Mensal</span>
                      <span className="text-2xl font-black mb-1">Recruta</span>
                      <span className="font-bold">R$ 29,90 /mês</span>
                      {selectedPlan === 'MONTHLY' && <div className="absolute top-4 right-4 text-yellow-500 text-xl">✓</div>}
                   </button>
                   <button 
                      type="button"
                      onClick={() => setSelectedPlan('ANNUAL')}
                      className={`p-6 border-2 rounded-[2rem] flex flex-col text-left transition-all relative overflow-hidden
                        ${selectedPlan === 'ANNUAL' ? 'border-slate-950 bg-slate-950 text-white shadow-xl' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}
                      `}
                   >
                      <div className="absolute top-0 right-0 bg-yellow-500 text-slate-950 px-3 py-1 text-[8px] font-black uppercase">Economize 40%</div>
                      <span className="text-[10px] font-black uppercase tracking-widest mb-2 opacity-60">Anual</span>
                      <span className="text-2xl font-black mb-1">Elite</span>
                      <span className="font-bold">R$ 297,00 /ano</span>
                      {selectedPlan === 'ANNUAL' && <div className="absolute top-4 right-4 text-yellow-500 text-xl">✓</div>}
                   </button>
                </div>
             </div>

             <form onSubmit={handlePay} className="space-y-8">
                {errorMessage && (
                   <div className="bg-red-50 border border-red-200 p-6 rounded-2xl text-red-700 text-sm font-bold">
                      ⚠️ ERRO: {errorMessage}
                   </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div onClick={() => setSelectedMethod('CARD')} className="cursor-pointer">
                     <PaymentMethodOption icon="💳" label="Cartão" active={selectedMethod === 'CARD'} />
                   </div>
                   <div onClick={() => setSelectedMethod('BOLETO')} className="cursor-pointer">
                     <PaymentMethodOption icon="📄" label="Boleto" active={selectedMethod === 'BOLETO'} />
                   </div>
                   <div onClick={() => setSelectedMethod('PIX')} className="cursor-pointer">
                     <PaymentMethodOption icon="📱" label="PIX" active={selectedMethod === 'PIX'} />
                   </div>
                </div>

                {selectedMethod === 'PIX' ? (
                  <div className="bg-yellow-50 p-8 rounded-[2.5rem] border-2 border-yellow-200 shadow-inner">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-yellow-500 rounded-full flex items-center justify-center text-2xl shadow-lg">🔑</div>
                      <h3 className="text-xl font-black tracking-tight text-yellow-900 uppercase">Pagamento via PIX</h3>
                    </div>
                    <p className="text-sm text-yellow-800 font-bold mb-6 leading-relaxed">
                      Transfira o valor exato para a chave abaixo e envie o comprovante para liberação imediata.
                    </p>
                    <div className="flex flex-col md:flex-row gap-6 mb-6">
                      <div className="flex-1 bg-white p-6 rounded-2xl border-2 border-yellow-300 group cursor-pointer active:scale-95 transition-transform" onClick={() => {
                        navigator.clipboard.writeText("41828832847");
                        alert("Chave PIX copiada!");
                      }}>
                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Chave PIX</p>
                        <p className="text-xl font-black text-slate-900 tracking-tighter break-all">418.288.328-47</p>
                        <p className="text-[10px] font-bold text-yellow-600 mt-2 uppercase tracking-widest">Clique para copiar chave</p>
                      </div>
                      <div className="w-full md:w-32 h-32 bg-white p-2 rounded-2xl border-2 border-yellow-300 flex items-center justify-center">
                        <button 
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            setLoading(true);
                            try {
                              const email = localStorage.getItem('PF_USER_EMAIL');
                              if (email) {
                                const res = await fetch(`/api/user/status?email=${encodeURIComponent(email)}`);
                                const data = await res.json();
                                if (data.status === 'active') {
                                  alert("Pagamento confirmado! Acesso liberado.");
                                  onPaymentComplete();
                                } else {
                                  alert("Pagamento ainda não detectado. Se já pagou, aguarde alguns minutos ou envie o comprovante.");
                                }
                              }
                            } catch (err) {
                              console.error(err);
                            } finally {
                              setLoading(false);
                            }
                          }}
                          className="text-[10px] font-black text-yellow-600 text-center uppercase hover:scale-105 transition-transform flex flex-col items-center gap-1"
                        >
                          <span className="text-xl">🔄</span>
                          {loading ? '...' : 'Verificar Pagamento'}
                        </button>
                      </div>
                    </div>
                    <div className="mt-4 p-4 bg-white/50 rounded-xl border border-yellow-200">
                      <p className="text-[10px] font-black uppercase text-yellow-600 mb-1">Favorecido / Desenvolvedor</p>
                      <p className="text-sm font-black text-yellow-900">Leonardo N. Pinheiro</p>
                    </div>

                    <div className="space-y-3 mt-6">
                      <p className="text-xs text-yellow-900 font-bold flex items-center gap-2">
                        <span className="w-5 h-5 bg-yellow-200 rounded-full flex items-center justify-center text-[10px]">1</span>
                        Abra o app do seu banco e escolha PIX.
                      </p>
                      <p className="text-xs text-yellow-900 font-bold flex items-center gap-2">
                        <span className="w-5 h-5 bg-yellow-200 rounded-full flex items-center justify-center text-[10px]">2</span>
                        Cole a chave acima.
                      </p>
                      <p className="text-xs text-yellow-900 font-bold flex items-center gap-2">
                        <span className="w-5 h-5 bg-yellow-200 rounded-full flex items-center justify-center text-[10px]">3</span>
                        Confirme o nome <strong>Leonardo N. Pinheiro</strong>.
                      </p>
                      <p className="text-xs text-yellow-900 font-bold flex items-center gap-2">
                        <span className="w-5 h-5 bg-yellow-200 rounded-full flex items-center justify-center text-[10px]">4</span>
                        Envie o comprovante para nosso WhatsApp/Suporte.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                    <p className="text-sm text-blue-800 font-medium leading-relaxed">
                        Você será redirecionado para o ambiente seguro do <strong>Stripe</strong> para finalizar seu pagamento. 
                        {selectedMethod === 'BOLETO' ? ' Lá você poderá gerar o código de barras do seu boleto.' : ' Aceitamos todas as bandeiras de cartão.'}
                    </p>
                  </div>
                )}

                <button 
                   type="submit"
                   disabled={loading && selectedMethod !== 'PIX'}
                   onClick={(e) => {
                     if (selectedMethod === 'PIX') {
                       e.preventDefault();
                       window.open('https://wa.me/5511939394092?text=Olá, acabei de fazer o PIX para o curso Polícia Foco!', '_blank');
                     }
                   }}
                   className="w-full bg-slate-900 text-white py-8 rounded-[2.5rem] font-black text-2xl hover:bg-slate-800 transition-all shadow-2xl hover:scale-[1.01] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                   {selectedMethod === 'PIX' ? 'ENVIAR COMPROVANTE (WHATSAPP)' : (loading ? 'PROCESSANDO...' : `PAGAR R$ ${planInfo[selectedPlan].price.toFixed(2).replace('.', ',')} AGORA`)}
                </button>
             </form>

             <p className="mt-12 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">
                Garantia de 7 dias incondicional &bull; Satisfação ou Reembolso
             </p>
          </div>
       </div>
    </div>
  );
};

const PaymentMethodOption = ({ icon, label, active }: any) => (
  <div className={`p-6 border-2 rounded-[2rem] flex items-center gap-4 cursor-pointer transition-all
     ${active ? 'border-slate-900 bg-slate-900 text-white shadow-xl' : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200'}
  `}>
     <span className="text-2xl">{icon}</span>
     <span className="font-black text-xs uppercase tracking-tight">{label}</span>
  </div>
);
