import { LocalAiProvider, LOCAL_RUNTIME_UNAVAILABLE } from './localAiProvider';
import { LocalInferenceRuntimeError } from '../runtime/localInferenceContracts';

async function run(): Promise<void> {
  const provider = new LocalAiProvider();
  const status = provider.getStatus();
  if (status.state !== 'unavailable') throw new Error('Local provider must be unavailable without a runtime/model manager.');

  try {
    await provider.sendMessage([{ id: 'm', conversationId: 'c', role: 'user', content: 'hello' }]);
    throw new Error('Local provider fabricated a response.');
  } catch (error) {
    if (!(error instanceof LocalInferenceRuntimeError) || error.code !== LOCAL_RUNTIME_UNAVAILABLE) {
      throw new Error('Local provider did not expose LOCAL_RUNTIME_UNAVAILABLE.');
    }
  }

  console.log('Local provider tests passed: unavailable runtime is explicit and no response is fabricated.');
}
run().catch((error: unknown) => { console.error(error); throw error; });
