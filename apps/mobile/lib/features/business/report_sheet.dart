import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';

import '../../core/errors.dart';
import '../../data/models.dart';
import '../../state/providers.dart';

class ReportSheet extends ConsumerStatefulWidget {
  const ReportSheet({super.key, required this.businessId});
  final String businessId;

  @override
  ConsumerState<ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends ConsumerState<ReportSheet> {
  ReportReason _reason = ReportReason.wrongPrice;
  final _message = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _message.dispose();
    super.dispose();
  }

  Future<void> _send() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await ref.read(accountRepoProvider).report(businessId: widget.businessId, reason: _reason, message: _message.text);
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      setState(() => _error = friendlyError(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(16, 0, 16, 16 + MediaQuery.viewInsetsOf(context).bottom),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Hatalı bilgi bildir', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          RadioGroup<ReportReason>(
            groupValue: _reason,
            onChanged: (v) => setState(() => _reason = v ?? _reason),
            child: Column(children: [
              for (final r in ReportReason.values) RadioListTile<ReportReason>(contentPadding: EdgeInsets.zero, value: r, title: Text(r.label)),
            ]),
          ),
          TextField(
            controller: _message,
            maxLength: 1000,
            maxLines: 3,
            decoration: const InputDecoration(hintText: 'Ayrıntı (isteğe bağlı)'),
          ),
          if (_error != null) Text(_error!, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 8),
          SizedBox(width: double.infinity, child: FilledButton(onPressed: _busy ? null : _send, child: const Text('Gönder'))),
        ]),
      ),
    );
  }
}
