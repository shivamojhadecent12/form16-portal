import { useState, useRef, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { EmptyState } from '@/components/EmptyState';
import { useDocuments } from '@/hooks/useDocuments';
import { useChatHistory, useSendMessage, useClearChat } from '@/hooks/useChat';
import { useAuthStore } from '@/store/authStore';

export function EmployeeChat() {
  const { user } = useAuthStore();
  const { data: documents, isLoading: docsLoading } = useDocuments(user?.id);
  const [selectedDocId, setSelectedDocId] = useState<string>('');
  const [question, setQuestion] = useState('');
  const [language, setLanguage] = useState<'en' | 'hi'>('en');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const form16Documents = documents?.filter((d) => d.document_type === 'form16_partA' || d.document_type === 'form16_partB') || [];

  const { data: chatHistory, isLoading: chatLoading } = useChatHistory(
    user?.id || '',
    selectedDocId || undefined
  );
  const sendMessage = useSendMessage();
  const clearChat = useClearChat();

  useEffect(() => {
    if (form16Documents.length > 0 && !selectedDocId) {
      setSelectedDocId(form16Documents[0]._id);
    }
  }, [form16Documents, selectedDocId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleSend = async () => {
    if (!question.trim() || !selectedDocId || !user) return;

    const currentQuestion = question;
    setQuestion('');

    try {
      await sendMessage.mutateAsync({
        employeeId: user.id,
        documentId: selectedDocId,
        question: currentQuestion,
      });
    } catch (err) {
      alert('Failed to send message');
      setQuestion(currentQuestion);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (docsLoading) return <Layout><LoadingSpinner /></Layout>;

  if (form16Documents.length === 0) {
    return (
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chat with Form16</h1>
            <p className="text-gray-600 mt-1">Ask questions about your Form-16</p>
          </div>

          <div className="card">
            <EmptyState
              icon="💬"
              title="No Form-16 documents"
              description="You need at least one Form-16 document to use the chat feature."
            />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Chat with Form16</h1>
          <p className="text-gray-600 mt-1">Ask questions about your Form-16</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Document Selector */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2 className="font-semibold text-gray-900 mb-4">Select Document</h2>
              <div className="space-y-2">
                {form16Documents.map((doc) => (
                  <button
                    key={doc._id}
                    onClick={() => setSelectedDocId(doc._id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      selectedDocId === doc._id
                        ? 'border-primary-500 bg-primary-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-medium text-gray-900">{doc.financial_year}</p>
                    <p className="text-xs text-gray-500 mt-1">{doc.file_name}</p>
                  </button>
                ))}
              </div>

              {/* Language Selector */}
              <div className="mt-6">
                <label className="label text-xs">Language</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLanguage('en')}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                      language === 'en'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    English
                  </button>
                  <button
                    onClick={() => setLanguage('hi')}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors ${
                      language === 'hi'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    हिंदी
                  </button>
                </div>
              </div>

              <div className="mt-6 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  💡 {language === 'en' ? 'Ask questions like:' : 'जैसे सवाल पूछें:'}
                </p>
                <ul className="text-xs text-blue-700 mt-2 space-y-1">
                  {language === 'en' ? (
                    <>
                      <li>• What is my gross salary?</li>
                      <li>• How much tax did I pay?</li>
                      <li>• What are my deductions?</li>
                      <li>• Show my investments</li>
                    </>
                  ) : (
                    <>
                      <li>• मेरा सकल वेतन क्या है?</li>
                      <li>• मैंने कितना कर चुकाया?</li>
                      <li>• मेरी कटौती क्या है?</li>
                      <li>• मेरे निवेश दिखाएं</li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3">
            <div className="card h-[600px] flex flex-col">
              {/* Header with Clear Button */}
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-gray-200">
                <h2 className="font-semibold text-gray-900">
                  {language === 'en' ? 'Chat with Form-16' : 'फॉर्म-16 के साथ चैट'}
                </h2>
                <button
                  onClick={() => {
                    if (window.confirm(language === 'en' ? 'Clear all chat history?' : 'सभी चैट इतिहास साफ करें?')) {
                      clearChat.mutate({ documentId: selectedDocId });
                    }
                  }}
                  disabled={!selectedDocId || (chatHistory?.length ?? 0) === 0 || clearChat.isPending}
                  className="text-sm px-3 py-1.5 rounded-lg bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 font-medium transition-colors"
                >
                  🗑️ {language === 'en' ? 'Clear' : 'साफ करें'}
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto mb-4 space-y-4">
                {chatLoading ? (
                  <LoadingSpinner />
                ) : !chatHistory || chatHistory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">💬</div>
                    <p className="text-gray-500">{language === 'en' ? 'Start a conversation' : 'बातचीत शुरू करें'}</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {language === 'en' ? 'Ask questions about your Form-16' : 'अपने फॉर्म-16 के बारे में प्रश्न पूछें'}
                    </p>
                  </div>
                ) : (
                  <>
                    {chatHistory.map((msg) => (
                      <div key={msg._id} className="space-y-3">
                        {/* Question */}
                        <div className="flex justify-end">
                          <div className="bg-primary-600 text-white rounded-lg px-4 py-2 max-w-[80%]">
                            <p className="text-sm">{msg.question}</p>
                          </div>
                        </div>

                        {/* Answer */}
                        <div className="flex justify-start">
                          <div className="bg-gray-100 text-gray-900 rounded-lg px-4 py-2 max-w-[80%]">
                            <p className="text-sm">{msg.answer}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              {new Date(msg.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              {/* Input */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={language === 'en' ? 'Ask a question about your Form-16...' : 'अपने फॉर्म-16 के बारे में प्रश्न पूछें...'}
                    className="input flex-1"
                    disabled={sendMessage.isPending}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!question.trim() || sendMessage.isPending}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendMessage.isPending ? (language === 'en' ? 'Sending...' : 'भेज रहे हैं...') : (language === 'en' ? 'Send' : 'भेजें')}
                  </button>
                </div>

                <p className="text-xs text-gray-500 mt-2">
                  ℹ️ {language === 'en' 
                    ? 'Answers are based only on information in your Form-16 document'
                    : 'उत्तर केवल आपके फॉर्म-16 दस्तावेज़ की जानकारी पर आधारित हैं'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
